"""
🛫 AI Runner — Run queue detection OR tracking OR both.

Usage:
    python run_ai.py --mode queue        # Queue counting only
    python run_ai.py --mode tracking     # Area-stay tracking only
    python run_ai.py --mode both         # Both (needs 2 webcams or same cam)

Deps: pip install ultralytics opencv-python numpy aiohttp python-dotenv
"""
import asyncio
import argparse
import sys


def main():
    parser = argparse.ArgumentParser(description="Airport AI Module")
    parser.add_argument(
        "--mode",
        choices=["queue", "tracking", "both"],
        default="queue",
        help="Which AI module to run (default: queue)",
    )
    parser.add_argument(
        "--source",
        type=int,
        default=0,
        help="Webcam index (default: 0)",
    )
    args = parser.parse_args()

    print("=" * 50)
    print("  🛫 Airport AI Monitor")
    print(f"  Mode: {args.mode}")
    print(f"  Webcam: {args.source}")
    print("=" * 50)
    print()

    if args.mode == "queue":
        from ai.queue_analytics.detector import QueueAnalyzer
        analyzer = QueueAnalyzer()
        asyncio.run(analyzer.run(source=args.source))

    elif args.mode == "tracking":
        from ai.face_tracking.tracker import AreaStayMonitor
        monitor = AreaStayMonitor()
        asyncio.run(monitor.run(source=args.source))

    elif args.mode == "both":
        # Run both on same webcam (different processing)
        print("⚠️  Running both modules on the same webcam.")
        print("   For best results, use separate webcams.\n")

        async def run_both():
            from ai.queue_analytics.detector import QueueAnalyzer
            from ai.face_tracking.tracker import AreaStayMonitor

            analyzer = QueueAnalyzer()
            monitor = AreaStayMonitor()

            await asyncio.gather(
                analyzer.run(source=args.source),
                monitor.run(source=args.source),
            )

        asyncio.run(run_both())


if __name__ == "__main__":
    main()
