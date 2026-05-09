# Camera demo videos

Drop short looping MP4 clips into this folder. Each filename below maps to one
camera in the Cameras page. If a file is missing, the camera tile falls back to
the AI-processing placeholder — so partial setup is fine for development.

## Required filenames

| Filename                  | Camera                           | Suggested content                         |
|---------------------------|----------------------------------|-------------------------------------------|
| `check-in-hall.mp4`       | CAM-02 — Check-in Hall B         | Airport check-in counters, busy queue     |
| `security.mp4`            | CAM-03 — Security Checkpoint     | Passengers passing through metal detector |
| `duty-free.mp4`           | CAM-04 — Duty Free Area          | Shopping area with light foot traffic     |
| `gate-area.mp4`           | CAM-05 — Gate D1–D5              | Seating area near boarding gates          |
| `passport-control.mp4`    | CAM-06 — Passport Control        | Long passport queue                       |

CAM-01 (Check-in Hall A) does **not** need a video — it uses the laptop webcam
when the user grants permission. If they deny, the modal shows a "try again"
button without falling back to a video.

## Tips

- **Keep clips short.** 10–30 seconds is enough; the player loops automatically.
- **No audio needed.** All `<video>` elements are muted (browser autoplay policy).
- **Resolution.** 720p is plenty. Bigger files just slow page load.
- **Format.** MP4 (H.264) for maximum browser compatibility.
- **Source.** Use royalty-free stock footage (Pexels, Pixabay, Mixkit) or
  record short demo clips yourself. Do not use copyrighted news footage.

## Why local files (not YouTube/streams)?

The defense demo runs on a laptop without guaranteed internet. Bundling the
clips with the project means the demo always works, and there's no privacy /
licensing risk from external embed URLs.
