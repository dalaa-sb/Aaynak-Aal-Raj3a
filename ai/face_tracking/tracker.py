"""
👤 Face Tracking & Area-Stay Monitor — Real Webcam + YOLOv8
Tracks people by centroid proximity, detects loitering, sends to backend.

Run:  python -m ai.face_tracking.tracker
Deps: pip install ultralytics opencv-python numpy aiohttp scipy python-dotenv
"""
import cv2
import numpy as np
import time
import asyncio
import aiohttp
from ultralytics import YOLO

from ai.ai_config import (
    API_URL, YOLO_MODEL, YOLO_CONFIDENCE, PERSON_CLASS_ID,
    PROCESSING_FPS, SEND_INTERVAL, SUSPICIOUS_LOITER_MINUTES,
    MAX_DISAPPEARED_FRAMES, WEBCAM_SOURCE,
    DEFAULT_TRACKING_CAMERA, DEFAULT_TRACKING_ZONE,
    INTERNAL_API_KEY,
)


def _ingest_headers():
    """Build headers for AI → backend ingest requests."""
    h = {"Content-Type": "application/json"}
    if INTERNAL_API_KEY:
        h["X-Internal-Auth"] = INTERNAL_API_KEY
    return h


class CentroidTracker:
    """
    Tracks people across frames by matching centroids.
    Simple, no GPU needed, good for demo.
    """

    def __init__(self, max_disappeared: int = MAX_DISAPPEARED_FRAMES):
        self.next_id = 0
        self.objects = {}           # id → (cx, cy)
        self.disappeared = {}       # id → frames since last seen
        self.max_disappeared = max_disappeared
        self.first_seen = {}        # id → timestamp
        self.last_seen = {}         # id → timestamp

    def register(self, centroid):
        obj_id = f"TRK-{self.next_id:04d}"
        self.objects[obj_id] = centroid
        self.disappeared[obj_id] = 0
        self.first_seen[obj_id] = time.time()
        self.last_seen[obj_id] = time.time()
        self.next_id += 1
        return obj_id

    def deregister(self, obj_id):
        duration = time.time() - self.first_seen.get(obj_id, time.time())
        del self.objects[obj_id]
        del self.disappeared[obj_id]
        self.first_seen.pop(obj_id, None)
        self.last_seen.pop(obj_id, None)
        return obj_id, duration

    def get_duration(self, obj_id: str) -> float:
        return time.time() - self.first_seen.get(obj_id, time.time())

    def update(self, detections: list):
        """
        Match new detections to existing tracked objects.
        Returns: (active_tracks, exited_tracks)
        """
        exited = []

        # No detections → increment disappeared for everyone
        if not detections:
            for obj_id in list(self.disappeared.keys()):
                self.disappeared[obj_id] += 1
                if self.disappeared[obj_id] > self.max_disappeared:
                    eid, dur = self.deregister(obj_id)
                    exited.append((eid, dur))
            return self.objects.copy(), exited

        input_centroids = np.array(detections)

        # No existing objects → register all
        if not self.objects:
            for c in input_centroids:
                self.register(tuple(c))
            return self.objects.copy(), exited

        object_ids = list(self.objects.keys())
        object_centroids = np.array(list(self.objects.values()))

        # Distance matrix between existing and new centroids
        # Using manual distance calc to avoid scipy dependency issues
        diff = object_centroids[:, np.newaxis, :] - input_centroids[np.newaxis, :, :]
        D = np.sqrt((diff ** 2).sum(axis=2))

        rows = D.min(axis=1).argsort()
        cols = D.argmin(axis=1)[rows]

        used_rows = set()
        used_cols = set()

        for (row, col) in zip(rows, cols):
            if row in used_rows or col in used_cols:
                continue
            if D[row, col] > 120:  # max pixel distance to match
                continue
            obj_id = object_ids[row]
            self.objects[obj_id] = tuple(input_centroids[col])
            self.disappeared[obj_id] = 0
            self.last_seen[obj_id] = time.time()
            used_rows.add(row)
            used_cols.add(col)

        # Unmatched existing → disappeared
        for row in range(len(object_ids)):
            if row not in used_rows:
                obj_id = object_ids[row]
                self.disappeared[obj_id] += 1
                if self.disappeared[obj_id] > self.max_disappeared:
                    eid, dur = self.deregister(obj_id)
                    exited.append((eid, dur))

        # Unmatched new → register
        for col in range(len(input_centroids)):
            if col not in used_cols:
                self.register(tuple(input_centroids[col]))

        return self.objects.copy(), exited


class AreaStayMonitor:
    """Real webcam tracking with loitering detection."""

    def __init__(self):
        print(f"⏳ Loading YOLO model: {YOLO_MODEL} ...")
        self.model = YOLO(YOLO_MODEL)
        print(f"✅ Tracking model loaded: {YOLO_MODEL}")
        self.tracker = CentroidTracker()
        self.loiter_warned = set()
        self.last_send_time = 0
        self._session = None

    async def _get_session(self):
        """Reuse a single aiohttp session for all requests."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=5)
            )
        return self._session

    async def close(self):
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()

    def detect_people(self, frame: np.ndarray) -> list:
        """Detect people and return centroids."""
        results = self.model(frame, conf=YOLO_CONFIDENCE, verbose=False)
        centroids = []
        for r in results:
            for box in r.boxes:
                if int(box.cls[0]) == PERSON_CLASS_ID:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)
                    centroids.append((cx, cy))
        return centroids

    def draw_overlay(self, frame: np.ndarray, tracks: dict, zone: str) -> np.ndarray:
        """Draw tracking overlay on frame."""
        overlay = frame.copy()

        for tid, centroid in tracks.items():
            duration = self.tracker.get_duration(tid)
            minutes = duration / 60

            # Color: green → yellow → red based on time
            if minutes < 5:
                color = (0, 255, 0)
            elif minutes < SUSPICIOUS_LOITER_MINUTES:
                color = (0, 255, 255)
            else:
                color = (0, 0, 255)

            cv2.circle(overlay, (int(centroid[0]), int(centroid[1])), 8, color, -1)
            label = f"{tid} ({minutes:.1f}m)"
            cv2.putText(overlay, label,
                        (int(centroid[0]) - 30, int(centroid[1]) - 15),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 2)

        # Status bar
        cv2.rectangle(overlay, (0, 0), (500, 50), (0, 0, 0), -1)
        cv2.putText(overlay,
                    f"Zone: {zone}  |  Tracked: {len(tracks)}  |  Loiter warnings: {len(self.loiter_warned)}",
                    (10, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
        return overlay

    async def send_to_backend(self, event_type: str, track_id: str,
                               camera_id: str, zone: str,
                               duration_seconds: float = None):
        """
        Send tracking events to backend via POST /api/tracking/ingest.
        This triggers loitering/overstay/re-entry alerts and WS broadcasts.
        """
        now = time.time()
        # Rate limit: only send important events, not every frame
        if event_type == "enter" and now - self.last_send_time < 1:
            return
        self.last_send_time = now

        # Only send meaningful events
        if event_type not in ("enter", "exit", "loiter"):
            return

        payload = {
            "track_id": track_id,
            "camera_id": camera_id,
            "zone": zone,
            "event_type": event_type,
            "duration_seconds": round(duration_seconds, 1) if duration_seconds else None,
        }

        try:
            session = await self._get_session()
            async with session.post(
                f"{API_URL}/api/tracking/ingest",
                json=payload,
                headers=_ingest_headers(),
            ) as resp:
                if resp.status == 200:
                    print(f"📤 Sent: {event_type} — {track_id} in {zone}")
                else:
                    text = await resp.text()
                    print(f"⚠️ API {resp.status}: {text[:80]}")
        except aiohttp.ClientConnectorError:
            print(f"⚠️ Cannot connect to backend at {API_URL}")
        except Exception as e:
            print(f"⚠️ Send failed: {e}")

    async def run(self, source=None, camera_id=None, zone=None):
        """
        Main loop: webcam → detect → track → send events.
        Press 'q' to stop.
        """
        src = source if source is not None else WEBCAM_SOURCE
        cam = camera_id or DEFAULT_TRACKING_CAMERA
        zn = zone or DEFAULT_TRACKING_ZONE

        print(f"📹 Opening webcam (source={src}) for area-stay tracking...")
        cap = cv2.VideoCapture(src)

        if not cap.isOpened():
            print(f"❌ Cannot open webcam (source={src})")
            return

        print(f"✅ Webcam opened — Camera: {cam}, Zone: {zn}")
        print(f"   Loiter threshold: {SUSPICIOUS_LOITER_MINUTES} min")
        print(f"   Press 'q' in the video window to stop\n")

        frame_delay = 1.0 / PROCESSING_FPS

        while True:
            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.5)
                continue

            # Detect people centroids
            centroids = self.detect_people(frame)

            # Update tracker
            active_tracks, exited = self.tracker.update(centroids)

            # Handle exits — send to backend
            for track_id, duration in exited:
                await self.send_to_backend("exit", track_id, cam, zn, duration)
                self.loiter_warned.discard(track_id)

            # Check for loitering
            for tid in active_tracks:
                dur = self.tracker.get_duration(tid)
                if dur / 60 > SUSPICIOUS_LOITER_MINUTES and tid not in self.loiter_warned:
                    self.loiter_warned.add(tid)
                    await self.send_to_backend("loiter", tid, cam, zn, dur)
                    print(f"🔴 LOITER DETECTED: {tid} — {dur/60:.1f} min in {zn}")

            # Show live overlay
            overlay = self.draw_overlay(frame, active_tracks, zn)
            cv2.imshow(f"Tracking: {cam}", overlay)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                print("\n🛑 Stopped by user")
                break

            await asyncio.sleep(frame_delay)

        cap.release()
        cv2.destroyAllWindows()
        await self.close()


# ─── Entry point ──────────────────────────────────────────
async def main():
    monitor = AreaStayMonitor()
    await monitor.run()

if __name__ == "__main__":
    asyncio.run(main())
