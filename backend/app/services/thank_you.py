import time
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.logger import logger
from app.models.tournament import Tournament, TournamentMember
from app.models.user import User
from app.services.email import send_thank_you_email

DELAY_SECONDS = 0.5  # stay well under Resend rate limits


def get_pending_recipients(db: Session, only_email: str | None = None) -> list[User]:
    """Users who haven't been sent the thank-you email yet.

    `only_email` bypasses the already-sent filter, so a specific address can be
    used for test sends even after the real batch has already gone out.
    """
    query = db.query(User)
    if only_email:
        return query.filter(User.email == only_email).all()
    return query.filter(User.thank_you_sent_at.is_(None)).order_by(User.email).all()


def send_thank_you_batch(db: Session, users: list[User], delay_seconds: float = DELAY_SECONDS) -> dict:
    """Send the thank-you email to each user, marking them sent as we go so a
    re-run (accidental or intentional) never double-sends. Returns counts —
    `failed` is a count only; email addresses are logged server-side, not
    returned, to avoid exposing recipient PII in the response payload."""
    sent, skipped, failed = 0, 0, 0
    for u in users:
        locale = "pt" if (u.language or "").startswith("pt") else "en"
        name = u.display_name or u.username
        leagues = (
            db.query(Tournament.name, Tournament.invite_code)
            .join(TournamentMember, TournamentMember.tournament_id == Tournament.id)
            .filter(TournamentMember.user_id == u.id)
            .order_by(Tournament.name)
            .all()
        )
        try:
            did_send = send_thank_you_email(u.email, name, leagues=leagues, locale=locale)
        except Exception as exc:
            logger.error("Failed to send thank-you email", to=u.email, error=str(exc))
            failed += 1
            time.sleep(delay_seconds)
            continue

        if did_send:
            u.thank_you_sent_at = datetime.now(timezone.utc)
            db.add(u)
            db.commit()
            sent += 1
        else:
            skipped += 1
        time.sleep(delay_seconds)

    logger.info("Thank-you email batch complete", sent=sent, skipped=skipped, failed=failed)
    return {"sent": sent, "skipped": skipped, "failed": failed}
