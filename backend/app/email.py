"""Email helpers — SMTP delivery, gracefully skipped when SMTP is unconfigured."""

from __future__ import annotations

import logging
import smtplib
from email.mime.text import MIMEText

from app.config import get_settings

logger = logging.getLogger(__name__)


def send_member_invite(
    *,
    to_email: str,
    project_name: str,
    role: str,
    invited_by_email: str,
    login_url: str = "https://arcsphere3d.dev",
) -> None:
    """Send a project invitation email in a background thread."""
    settings = get_settings()
    if not settings.smtp_enabled:
        logger.info(
            "SMTP not configured — skipping invite email to %s for project %r",
            to_email,
            project_name,
        )
        return

    body = (
        f"こんにちは。\n\n"
        f"{invited_by_email} さんがあなたを ArcSphere3D プロジェクト「{project_name}」に"
        f" {role} として招待しました。\n\n"
        f"以下の URL からログインしてプロジェクトを確認できます:\n{login_url}\n\n"
        f"このメールに心当たりがない場合は無視してください。\n"
    )
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = f"[ArcSphere3D] プロジェクト「{project_name}」に招待されました"
    msg["From"] = settings.smtp_from
    msg["To"] = to_email

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            smtp.ehlo()
            if settings.smtp_user:
                smtp.starttls()
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.sendmail(settings.smtp_from, [to_email], msg.as_string())
        logger.info("Invite email sent to %s for project %r", to_email, project_name)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to send invite email to %s", to_email)
