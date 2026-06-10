import httpx

from app.config import settings
from app.logger import logger

RESEND_API_URL = "https://api.resend.com/emails"
FROM_ADDRESS = "noreply@wcfootballpredictions.com"


def send_password_reset_email(to_email: str, reset_url: str) -> None:
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping password reset email", to=to_email)
        return

    html = f"""<!DOCTYPE html>
<html lang="en">
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
                    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#f0b429;">Password Reset</p>
                    <h1 style="margin:0 0 20px;font-size:26px;font-weight:800;color:#1a2332;line-height:1.2;">Reset your password</h1>
                    <p style="margin:0 0 28px;font-size:15px;color:#4a5568;line-height:1.6;">
                      We received a request to reset the password for your WC Football Predictions account.
                      Click the button below to choose a new one.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 48px 32px;">
                    <a href="{reset_url}"
                       style="display:inline-block;background-color:#f0b429;color:#1a2332;font-size:14px;font-weight:800;
                              letter-spacing:2px;text-transform:uppercase;text-decoration:none;
                              padding:16px 40px;border-radius:10px;">
                      Reset My Password
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 48px 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fc;border-radius:10px;border-left:3px solid #f0b429;">
                      <tr>
                        <td style="padding:14px 18px;">
                          <p style="margin:0;font-size:13px;color:#718096;line-height:1.5;">
                            ⏱ This link expires in <strong style="color:#1a2332;">15 minutes</strong>.<br>
                            If the button doesn't work, copy and paste this URL into your browser:<br>
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
                      If you didn't request a password reset, you can safely ignore this email —
                      your password will not change.
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
        "subject": "Reset your WC Football Predictions password",
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
