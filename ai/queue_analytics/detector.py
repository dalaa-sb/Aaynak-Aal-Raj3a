"""
🔢 Queue Analytics — Real Webcam + YOLOv8 People Counting
Sends REAL detection results to backend via POST /api/queue/ingest

Run:  python -m ai.queue_analytics.detector
Deps: pip install ultralytics opencv-python numpy aiohttp python-dotenv
"""
import cv2
import numpy as np
import time
import asyncio
import aiohttp
from ultralytics import YOLO

from ai.ai_config import (
    API_URL, YOLO_MODEL, YOLO_CONFIDENCE, PERSON_CLASS_ID,
    PROCESSING_FPS, SEND_INTERVAL, QUEUE_WARNING, QUEUE_CRITICAL,
    WEBCAM_SOURCE, DEFAULT_QUEUE_CAMERA, DEFAULT_QUEUE_ZONE,
    INTERNAL_API_KEY,
)


def _ingest_headers():
    """Build headers for AI → backend ingest requests.
    Includes X-Internal-Auth if INTERNAL_API_KEY is configured."""
    h = {"Content-Type": "application/json"}
    if INTERNAL_API_KEY:
        h["X-Internal-Auth"] = INTERNAL_API_KEY
    return h


class QueueAnalyzer:
    """Detects people from real webcam frames using YOLOv8."""

    def __init__(self):
        print(f"⏳ Loading YOLO model: {YOLO_MODEL} ...")
        self.model = YOLO(YOLO_MODEL)
        print(f"✅ YOLO model loaded: {YOLO_MODEL}")
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
        """Run YOLO inference, return list of detected people."""
        results = self.model(frame, conf=YOLO_CONFIDENCE, verbose=False)
        people = []
        for r in results:
            for box in r.boxes:
                if int(box.cls[0]) == PERSON_CLASS_ID:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    people.append({
                        "bbox": [int(x1), int(y1), int(x2), int(y2)],
                        "confidence": round(conf, 2),
                        "center": (int((x1 + x2) / 2), int((y1 + y2) / 2)),
                    })
        return people

    def estimate_density(self, people: list, frame_shape: tuple) -> float:
        """Crowd density = ratio of person bounding box area to frame area."""
        if not people:
            return 0.0
        total_area = frame_shape[0] * frame_shape[1]
        person_area = sum(
            (p["bbox"][2] - p["bbox"][0]) * (p["bbox"][3] - p["bbox"][1])
            for p in people
        )
        return min(person_area / total_area, 1.0)

    def draw_overlay(self, frame: np.ndarray, people: list, density: float) -> np.ndarray:
        """Draw bounding boxes and stats overlay on the frame."""
        overlay = frame.copy()
        count = len(people)

        # Color based on count
        if count < QUEUE_WARNING:
            color = (0, 255, 0)       # green
            status = "NORMAL"
        elif count < QUEUE_CRITICAL:
            color = (0, 165, 255)     # orange
            status = "WARNING"
        else:
            color = (0, 0, 255)       # red
            status = "CRITICAL"

        # Draw each person
        for p in people:
            x1, y1, x2, y2 = p["bbox"]
            cv2.rectangle(overlay, (x1, y1), (x2, y2), color, 2)
            cv2.circle(overlay, p["center"], 4, color, -1)
            # Confidence label
            cv2.putText(overlay, f'{p["confidence"]:.0%}',
                        (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

        # Status bar at top
        cv2.rectangle(overlay, (0, 0), (420, 80), (0, 0, 0), -1)
        cv2.putText(overlay, f"People: {count}  |  Density: {density:.1%}",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.putText(overlay, f"Status: {status}  |  Zone: {DEFAULT_QUEUE_ZONE}",
                    (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        return overlay

    async def send_to_backend(self, person_count: int, density: float):
        """
        Send real detection results to the backend.
        Uses POST /api/queue/ingest — the proper queue processing pipeline.
        This triggers zone_status updates, threshold-based alerts, and WS broadcasts.
        Rate-limited to avoid flooding.
        """
        now = time.time()
        if now - self.last_send_time < SEND_INTERVAL:
            return  # Skip, too soon
        self.last_send_time = now

        payload = {
            "camera_id": DEFAULT_QUEUE_CAMERA,
            "zone": DEFAULT_QUEUE_ZONE,
            "person_count": person_count,
            "density": round(density, 4),
        }

        try:
            session = await self._get_session()
            async with session.post(
                f"{API_URL}/api/queue/ingest",
                json=payload,
                headers=_ingest_headers(),
            ) as resp:
                if resp.status == 200:
                    print(f"📤 Sent: {person_count} people, density={density:.2%}")
                else:
                    text = await resp.text()
                    print(f"⚠️ API responded {resp.status}: {text[:100]}")
        except aiohttp.ClientConnectorError:
            print(f"⚠️ Cannot connect to backend at {API_URL} — is it running?")
        except Exception as e:
            print(f"⚠️ API send failed: {e}")

    async def run(self, source=None, camera_id=None, zone=None):
        """
        Main loop: open webcam → detect people → send to backend.
        Press 'q' to quit.
        """
        src = source if source is not None else WEBCAM_SOURCE
        cam = camera_id or DEFAULT_QUEUE_CAMERA
        zn = zone or DEFAULT_QUEUE_ZONE

        print(f"📹 Opening webcam (source={src}) for queue detection...")
        cap = cv2.VideoCapture(src)

        if not cap.isOpened():
            print(f"❌ Cannot open webcam (source={src})")
            print("   Try: set WEBCAM_SOURCE=0 in .env or pass a different source")
            return

        print(f"✅ Webcam opened — Camera: {cam}, Zone: {zn}")
        print(f"   Processing at {PROCESSING_FPS} FPS, sending every {SEND_INTERVAL}s")
        print(f"   Press 'q' in the video window to stop\n")

        frame_delay = 1.0 / PROCESSING_FPS

        while True:
            ret, frame = cap.read()
            if not ret:
                print("⚠️ Frame read failed, retrying...")
                await asyncio.sleep(0.5)
                continue

            # Real YOLO detection
            people = self.detect_people(frame)
            density = self.estimate_density(people, frame.shape)
            count = len(people)

            # Send real data to backend
            await self.send_to_backend(count, density)

            # Show live overlay
            overlay = self.draw_overlay(frame, people, density)
            cv2.imshow(f"Queue Detection: {cam}", overlay)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                print("\n🛑 Stopped by user")
                break

            await asyncio.sleep(frame_delay)

        cap.release()
        cv2.destroyAllWindows()
        await self.close()


# ─── Entry point ──────────────────────────────────────────
async def main():
    analyzer = QueueAnalyzer()
    await analyzer.run()

if __name__ == "__main__":
    asyncio.run(main())
