import base64
import html as _html
from datetime import timezone
from typing import TYPE_CHECKING

import httpx

from app.config import settings
from app.logger import logger

if TYPE_CHECKING:
    from app.models.match import Match

RESEND_API_URL = "https://api.resend.com/emails"
FROM_ADDRESS = "noreply@wcfootballpredictions.com"

_DAYS_PT = {"Mon": "Seg", "Tue": "Ter", "Wed": "Qua", "Thu": "Qui", "Fri": "Sex", "Sat": "Sáb", "Sun": "Dom"}
_MONTHS_PT = {
    "Jan": "Jan", "Feb": "Fev", "Mar": "Mar", "Apr": "Abr", "May": "Mai", "Jun": "Jun",
    "Jul": "Jul", "Aug": "Ago", "Sep": "Set", "Oct": "Out", "Nov": "Nov", "Dec": "Dez",
}
_TEAMS_PT: dict[str, str] = {
    "Albania": "Albânia",
    "Algeria": "Argélia",
    "Bosnia": "Bósnia",
    "Bosnia and Herzegovina": "Bósnia e Herzegovina",
    "Bosnia-Herzegovina": "Bósnia e Herzegovina",
    "Burkina Faso": "Burkina Faso",
    "Cape Verde": "Cabo Verde",
    "Cape Verde Islands": "Cabo Verde",
    "Congo DR": "RD Congo",
    "Czechia": "República Tcheca",
    "DR Congo": "RD Congo",
    "Democratic Republic of Congo": "República Democrática do Congo",
    "India": "Índia",
    "Russia": "Rússia",
    "Scotland": "Escócia",
    "Sweden": "Suécia",
    "Thailand": "Tailândia",
    "Tunisia": "Tunísia",
    "USA": "EUA",
    "United Arab Emirates": "Emirados Árabes Unidos",
    "Uzbekistan": "Uzbequistão",
    "Vietnam": "Vietnã",
    "Argentina": "Argentina",
    "Australia": "Austrália",
    "Austria": "Áustria",
    "Belgium": "Bélgica",
    "Bolivia": "Bolívia",
    "Brazil": "Brasil",
    "Cameroon": "Camarões",
    "Canada": "Canadá",
    "Chile": "Chile",
    "Colombia": "Colômbia",
    "Costa Rica": "Costa Rica",
    "Croatia": "Croácia",
    "Czech Republic": "República Tcheca",
    "Denmark": "Dinamarca",
    "Ecuador": "Equador",
    "Egypt": "Egito",
    "El Salvador": "El Salvador",
    "England": "Inglaterra",
    "France": "França",
    "Germany": "Alemanha",
    "Ghana": "Gana",
    "Greece": "Grécia",
    "Guatemala": "Guatemala",
    "Honduras": "Honduras",
    "Hungary": "Hungria",
    "Indonesia": "Indonésia",
    "Iran": "Irã",
    "Iraq": "Iraque",
    "Israel": "Israel",
    "Italy": "Itália",
    "Ivory Coast": "Costa do Marfim",
    "Jamaica": "Jamaica",
    "Japan": "Japão",
    "Jordan": "Jordânia",
    "Kenya": "Quênia",
    "Mali": "Mali",
    "Mexico": "México",
    "Morocco": "Marrocos",
    "Netherlands": "Holanda",
    "New Zealand": "Nova Zelândia",
    "Nigeria": "Nigéria",
    "Norway": "Noruega",
    "Panama": "Panamá",
    "Paraguay": "Paraguai",
    "Peru": "Peru",
    "Poland": "Polônia",
    "Portugal": "Portugal",
    "Qatar": "Catar",
    "Romania": "Romênia",
    "Saudi Arabia": "Arábia Saudita",
    "Senegal": "Senegal",
    "Serbia": "Sérvia",
    "Slovakia": "Eslováquia",
    "Slovenia": "Eslovênia",
    "South Africa": "África do Sul",
    "South Korea": "Coreia do Sul",
    "Spain": "Espanha",
    "Switzerland": "Suíça",
    "Turkey": "Turquia",
    "Ukraine": "Ucrânia",
    "United States": "Estados Unidos",
    "Uruguay": "Uruguai",
    "Venezuela": "Venezuela",
    "Wales": "País de Gales",
    "Zimbabwe": "Zimbábue",
}

_LOCALE_DAYS = {"pt": _DAYS_PT}
_LOCALE_MONTHS = {"pt": _MONTHS_PT}
_LOCALE_TEAMS = {"pt": _TEAMS_PT}


def _translate_team(name: str, locale: str) -> str:
    return _LOCALE_TEAMS.get(locale, {}).get(name, name)


def _fmt_date_localized(kickoff_at, locale: str) -> str:
    dt = kickoff_at
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    day = dt.strftime("%a")
    mon = dt.strftime("%b")
    days_map = _LOCALE_DAYS.get(locale, {})
    months_map = _LOCALE_MONTHS.get(locale, {})
    day_str = days_map.get(day, day)
    mon_str = months_map.get(mon, mon)
    return f"{day_str} {mon_str}/{dt.day} · {dt.strftime('%H:%M')} UTC"

_RESET_COPY = {
    "pt": {
        "subject": "Redefina sua senha do WC Football Predictions",
        "label": "Redefinição de Senha",
        "title": "Redefina sua senha",
        "body": (
            "Recebemos uma solicitação para redefinir a senha da sua conta WC Football Predictions. "
            "Clique no botão abaixo para escolher uma nova."
        ),
        "button": "Redefinir Minha Senha",
        "note_expiry": "⏱ Este link expira em <strong style=\"color:#1a2332;\">15 minutos</strong>.<br>"
                       "Se o botão não funcionar, copie e cole esta URL no seu navegador:",
        "footer": "Se você não solicitou a redefinição de senha, pode ignorar este e-mail — sua senha não será alterada.",
    },
}
_RESET_COPY_DEFAULT = {
    "subject": "Reset your WC Football Predictions password",
    "label": "Password Reset",
    "title": "Reset your password",
    "body": (
        "We received a request to reset the password for your WC Football Predictions account. "
        "Click the button below to choose a new one."
    ),
    "button": "Reset My Password",
    "note_expiry": "⏱ This link expires in <strong style=\"color:#1a2332;\">15 minutes</strong>.<br>"
                   "If the button doesn't work, copy and paste this URL into your browser:",
    "footer": "If you didn't request a password reset, you can safely ignore this email — your password will not change.",
}


def send_password_reset_email(to_email: str, reset_url: str, locale: str = "en") -> None:
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping password reset email", to=to_email)
        return

    c = _RESET_COPY.get(locale, _RESET_COPY_DEFAULT)

    html = f"""<!DOCTYPE html>
<html lang="{locale}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;letter-spacing:4px;text-transform:uppercase;">
                <span style="color:#f0b429;">WC</span><span style="color:#1a2332;">26</span>
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

              <!-- Gold top bar -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:4px;background:linear-gradient(90deg,#f0b429,#fcd86e,#f0b429);"></td>
                </tr>
              </table>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:40px 48px 16px;">
                    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#f0b429;">{c['label']}</p>
                    <h1 style="margin:0 0 20px;font-size:26px;font-weight:800;color:#1a2332;line-height:1.2;">{c['title']}</h1>
                    <p style="margin:0 0 28px;font-size:15px;color:#4a5568;line-height:1.6;">
                      {c['body']}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 48px 32px;">
                    <a href="{reset_url}"
                       style="display:inline-block;background-color:#f0b429;color:#1a2332;font-size:14px;font-weight:800;
                              letter-spacing:2px;text-transform:uppercase;text-decoration:none;
                              padding:16px 40px;border-radius:10px;">
                      {c['button']}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 48px 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fc;border-radius:10px;border-left:3px solid #f0b429;">
                      <tr>
                        <td style="padding:14px 18px;">
                          <p style="margin:0;font-size:13px;color:#718096;line-height:1.5;">
                            {c['note_expiry']}
                            <a href="{reset_url}" style="color:#f0b429;word-break:break-all;font-size:12px;">{reset_url}</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 48px 40px;">
                    <p style="margin:0;font-size:13px;color:#a0aec0;line-height:1.6;">
                      {c['footer']}
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 0 0;">
              <p style="margin:0;font-size:12px;color:#a0aec0;">
                WC Football Predictions &nbsp;·&nbsp; wcfootballpredictions.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    payload = {
        "from": FROM_ADDRESS,
        "to": [to_email],
        "subject": c["subject"],
        "html": html,
    }

    try:
        response = httpx.post(
            RESEND_API_URL,
            json=payload,
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            timeout=10,
        )
        response.raise_for_status()
        logger.info("Password reset email sent", to=to_email)
    except httpx.HTTPError as exc:
        logger.error("Failed to send password reset email", to=to_email, error=str(exc))
        raise


_CALENDAR_COPY = {
    "pt": {
        "subject": "📅 Coloca no teu calendário! — Copa do Mundo 2026",
        "label": "Exportação de Calendário",
        "title": "Seus jogos estão em anexo",
        "body_tpl": (
            "Abra o arquivo em anexo <strong>wc2026-fixtures.ics</strong> para adicionar "
            "os {count} {matches_word} abaixo ao seu calendário. "
            "Importar o arquivo novamente não criará duplicatas."
        ),
        "matches_one": "jogo",
        "matches_other": "jogos",
        "footer": "Este e-mail foi enviado porque você solicitou uma exportação de calendário do WC Football Predictions.",
    },
}
_CALENDAR_COPY_DEFAULT = {
    "subject": "📅 Put it on your calendar! — World Cup 2026",
    "label": "Calendar Export",
    "title": "Your fixtures are attached",
    "body_tpl": (
        "Open the attached <strong>wc2026-fixtures.ics</strong> file to add the "
        "{count} {matches_word} below to your calendar. "
        "Re-importing the file won't create duplicates."
    ),
    "matches_one": "match",
    "matches_other": "matches",
    "footer": "This email was sent because you requested a calendar export from WC Football Predictions.",
}


def send_calendar_email(to_email: str, matches: list["Match"], ics_bytes: bytes, locale: str = "en") -> None:
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping calendar email", to=to_email)
        return

    def _stage_label(stage: str, group) -> str:
        base = stage.replace("_", " ").title()
        return f"{base} — {group}" if group else base

    rows_html = "".join(
        f"""<tr>
          <td style="padding:10px 0;border-bottom:1px solid #edf2f7;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:15px;font-weight:700;color:#1a2332;">
                  {_html.escape(_translate_team(m.home_team, locale))} <span style="color:#a0aec0;font-weight:400;">vs</span> {_html.escape(_translate_team(m.away_team, locale))}
                </td>
                <td align="right" style="font-size:12px;color:#718096;white-space:nowrap;">
                  {_html.escape(_fmt_date_localized(m.kickoff_at, locale))}
                </td>
              </tr>
              <tr>
                <td colspan="2" style="font-size:11px;color:#a0aec0;padding-top:2px;">
                  {_html.escape(_stage_label(m.stage, m.group))}
                </td>
              </tr>
            </table>
          </td>
        </tr>"""
        for m in matches
    )

    match_count = len(matches)
    c = _CALENDAR_COPY.get(locale, _CALENDAR_COPY_DEFAULT)
    matches_word = c["matches_one"] if match_count == 1 else c["matches_other"]
    body_text = c["body_tpl"].format(count=match_count, matches_word=matches_word)

    html = f"""<!DOCTYPE html>
<html lang="{locale}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;letter-spacing:4px;text-transform:uppercase;">
                <span style="color:#f0b429;">WC</span><span style="color:#1a2332;">26</span>
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

              <!-- Blue top bar -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:4px;background:linear-gradient(90deg,#5a8fdf,#8aabf0,#5a8fdf);"></td>
                </tr>
              </table>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:40px 48px 8px;">
                    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#5a8fdf;">{c['label']}</p>
                    <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#1a2332;line-height:1.2;">{c['title']}</h1>
                    <p style="margin:0 0 28px;font-size:15px;color:#4a5568;line-height:1.6;">
                      {body_text}
                    </p>
                  </td>
                </tr>

                <!-- Match list -->
                <tr>
                  <td style="padding:0 48px 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #edf2f7;">
                      {rows_html}
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 48px 40px;">
                    <p style="margin:0;font-size:13px;color:#a0aec0;line-height:1.6;">
                      {c['footer']}
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 0 0;">
              <p style="margin:0;font-size:12px;color:#a0aec0;">
                WC Football Predictions &nbsp;·&nbsp; wcfootballpredictions.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    payload = {
        "from": FROM_ADDRESS,
        "to": [to_email],
        "subject": c["subject"],
        "html": html,
        "attachments": [
            {
                "filename": "wc2026-fixtures.ics",
                "content": base64.b64encode(ics_bytes).decode("utf-8"),
            }
        ],
    }

    try:
        response = httpx.post(
            RESEND_API_URL,
            json=payload,
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            timeout=10,
        )
        response.raise_for_status()
        logger.info("Calendar email sent", to=to_email, match_count=match_count)
    except httpx.HTTPError as exc:
        logger.error("Failed to send calendar email", to=to_email, error=str(exc))
        raise
