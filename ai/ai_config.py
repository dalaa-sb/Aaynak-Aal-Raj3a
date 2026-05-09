"""
AI Module Configuration
All AI settings here — independent of the backend config.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ─── Backend API ──────────────────────────────────────────
API_URL = os.getenv("API_URL", "http://localhost:8000")

# Shared secret with the backend's INTERNAL_API_KEY env var.
# When empty, the backend allows unauthenticated ingest (dev mode).
# In production deployment, MUST be set on both sides to the same value.
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "").strip()

# ─── YOLO Model ───────────────────────────────────────────
YOLO_MODEL = "yolov8n.pt"       # nano model = fastest, auto-downloads on first run
YOLO_CONFIDENCE = 0.4            # detection confidence threshold
PERSON_CLASS_ID = 0              # COCO class 0 = person

# ─── Processing ───────────────────────────────────────────
PROCESSING_FPS = 5               # frames per second to analyze (lower = less CPU)
SEND_INTERVAL = 3                # send data to API every N seconds (not every frame)

# ─── Queue Thresholds (for overlay display) ───────────────
QUEUE_WARNING = 15
QUEUE_CRITICAL = 30

# ─── Tracking Thresholds ──────────────────────────────────
SUSPICIOUS_LOITER_MINUTES = 15
MAX_DISAPPEARED_FRAMES = 50      # frames before a tracked person is considered "exited"

# ─── Camera Source ────────────────────────────────────────
# 0 = default webcam, 1 = second webcam, or RTSP URL string
WEBCAM_SOURCE = int(os.getenv("WEBCAM_SOURCE", "0"))

# ─── Camera-to-Zone Mapping ──────────────────────────────
# When running with a single webcam, assign it to these defaults
DEFAULT_QUEUE_CAMERA = "CAM-01"
DEFAULT_QUEUE_ZONE = "check_in_a"
DEFAULT_TRACKING_CAMERA = "CAM-03"
DEFAULT_TRACKING_ZONE = "security_1"
