#!/usr/bin/env python3
"""
Send the end-of-tournament thank-you email to every user who hasn't received
it yet (tracked via User.thank_you_sent_at, so a re-run never double-sends).

Usage:
    python scripts/send_thank_you_emails.py            # dry run — lists recipients, sends nothing
    python scripts/send_thank_you_emails.py --send      # actually sends
    python scripts/send_thank_you_emails.py --send --only you@example.com   # test send, bypasses the already-sent filter
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal
# Import every model module so SQLAlchemy can resolve User's relationships
# (Tournament, TournamentMember, Prediction, PointEvent) when configuring mappers.
from app.models import match, point_event, prediction, tournament, user  # noqa: F401
from app.services.thank_you import get_pending_recipients, send_thank_you_batch


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--send", action="store_true", help="actually send emails (default is dry run)")
    parser.add_argument("--only", help="send to a single email address only, bypassing the already-sent filter (for testing)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        users = get_pending_recipients(db, only_email=args.only)

        if not users:
            print("No pending recipients (everyone has already been thanked, or no matching user).")
            return

        print(f"{len(users)} recipient(s):")
        for u in users:
            print(f"  {u.email}  ({u.username})")

        if not args.send:
            print("\nDry run only — pass --send to actually email these users.")
            return

        confirm = input(f"\nAbout to send to {len(users)} user(s). Type 'yes' to continue: ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            return

        result = send_thank_you_batch(db, users)
        print(f"\nDone. Sent: {result['sent']}, Skipped (no RESEND_API_KEY): {result['skipped']}, Failed: {result['failed']}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
