import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from html import escape
from urllib.parse import urlencode

import httpx

from app.config import (
    ADMIN_EMAIL,
    API_PUBLIC_URL,
    APP_URL,
    BREVO_API_KEY,
    BREVO_SMTP_KEY,
    BREVO_SMTP_LOGIN,
    BREVO_SMTP_PORT,
    BREVO_SMTP_SERVER,
    SENDER_EMAIL,
    SENDER_NAME,
)

logger = logging.getLogger(__name__)
BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


def _send_with_brevo_api(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str | None,
    reply_to: str | None,
) -> bool:
    payload: dict = {
        "sender": {"name": SENDER_NAME, "email": SENDER_EMAIL},
        "to": [{"email": to_email}],
        "subject": subject,
        "textContent": text_body,
    }
    if html_body:
        payload["htmlContent"] = html_body
    if reply_to:
        payload["replyTo"] = {"email": reply_to}

    try:
        response = httpx.post(
            BREVO_API_URL,
            headers={"api-key": BREVO_API_KEY, "accept": "application/json"},
            json=payload,
            timeout=20,
        )
        response.raise_for_status()
        return True
    except Exception:
        logger.exception("Brevo API delivery failed for %s", to_email)
        return False


def send_email(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
    reply_to: str | None = None,
) -> bool:
    if not (BREVO_SMTP_LOGIN and BREVO_SMTP_KEY and SENDER_EMAIL):
        if BREVO_API_KEY and SENDER_EMAIL:
            return _send_with_brevo_api(to_email, subject, text_body, html_body, reply_to)
        logger.warning("Brevo SMTP is not configured; skipping email to %s", to_email)
        return False

    message = EmailMessage()
    message["From"] = formataddr((SENDER_NAME, SENDER_EMAIL))
    message["To"] = to_email
    message["Subject"] = subject
    if reply_to:
        message["Reply-To"] = reply_to
    message.set_content(text_body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(BREVO_SMTP_SERVER, BREVO_SMTP_PORT, timeout=20) as smtp:
            smtp.ehlo()
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
            smtp.login(BREVO_SMTP_LOGIN, BREVO_SMTP_KEY)
            smtp.send_message(message)
        return True
    except Exception:
        logger.exception("Brevo SMTP delivery failed for %s", to_email)
        if BREVO_API_KEY and SENDER_EMAIL:
            logger.warning("Falling back to Brevo API delivery")
            return _send_with_brevo_api(to_email, subject, text_body, html_body, reply_to)
        return False


def send_verification_email(to_email: str, username: str, token: str, expires_minutes: int) -> bool:
    verify_url = f"{API_PUBLIC_URL}/auth/verify-email?{urlencode({'token': token})}"
    text = (
        f"Hi {username},\n\n"
        "Verify your email address to activate your M.O.B TaskManager account.\n\n"
        f"Verify email: {verify_url}\n\n"
        f"This link expires in {expires_minutes} minutes and can only be used once. "
        "If you did not create this account, you can ignore this email.\n\n"
        "M.O.B TaskManager"
    )
    html = (
        f"<p>Hi {username},</p>"
        "<p>Verify your email address to activate your M.O.B TaskManager account.</p>"
        f'<p><a href="{verify_url}">Verify my email</a></p>'
        f"<p>This link expires in {expires_minutes} minutes and can only be used once.</p>"
    )
    return send_email(to_email, "Verify your M.O.B TaskManager email", text, html)


def send_welcome_email(to_email: str, username: str) -> bool:
    return send_email(
        to_email,
        "Welcome to M.O.B TaskManager",
        f"Hi {username},\n\nYour email is verified and your M.O.B TaskManager account is ready.\n\nM.O.B TaskManager",
    )


def send_habit_completion_email(to_email: str, username: str, habit_name: str, duration_days: int) -> bool:
    safe_name = habit_name.strip() or "your habit"
    html_username = escape(username)
    html_name = escape(safe_name)
    return send_email(
        to_email,
        f"You completed your {duration_days}-day habit!",
        (
            f"Hi {username},\n\n"
            f"Congratulations! You completed all {duration_days} daily check-ins for {safe_name}. "
            "That consistency is worth celebrating.\n\n"
            "Open M.O.B TaskManager to see your completed habit and choose what you want to build next.\n\n"
            "M.O.B TaskManager"
        ),
        (
            f"<h2>Congratulations, {html_username}!</h2>"
            f"<p>You completed all <strong>{duration_days} daily check-ins</strong> for <strong>{html_name}</strong>.</p>"
            "<p>That consistency is worth celebrating. Open M.O.B TaskManager to see your completed habit and choose what to build next.</p>"
        ),
    )


def send_challenge_completion_email(to_email: str, username: str, book_title: str, duration_days: int) -> bool:
    safe_title = book_title.strip() or "your book"
    return send_email(
        to_email,
        f"You completed your reading challenge!",
        (
            f"Hi {username},\n\n"
            f"Congratulations! You completed your {duration_days}-day reading challenge for {safe_title}. "
            "Your consistency is worth celebrating.\n\n"
            "Open M.O.B TaskManager to see your completed challenge and choose what to read next.\n\n"
            "M.O.B TaskManager"
        ),
        (
            f"<h2>Congratulations, {escape(username)}!</h2>"
            f"<p>You completed your <strong>{duration_days}-day reading challenge</strong> for <strong>{escape(safe_title)}</strong>.</p>"
            "<p>Open M.O.B TaskManager to celebrate your progress and choose what to read next.</p>"
        ),
    )


def send_project_completion_email(to_email: str, username: str, project_title: str) -> bool:
    safe_title = project_title.strip() or "your project"
    return send_email(
        to_email,
        f"You completed {safe_title}!",
        (
            f"Hi {username},\n\n"
            f"Congratulations! You moved {safe_title} to completed. That milestone is worth celebrating.\n\n"
            "Open M.O.B TaskManager to see your completed project and decide what comes next.\n\n"
            "M.O.B TaskManager"
        ),
        (
            f"<h2>Congratulations, {escape(username)}!</h2>"
            f"<p>You completed <strong>{escape(safe_title)}</strong>.</p>"
            "<p>Open M.O.B TaskManager to celebrate the milestone and decide what comes next.</p>"
        ),
    )


def send_password_reset_email(to_email: str, username: str, token: str, expires_minutes: int) -> bool:
    reset_url = f"{APP_URL}/reset-password?{urlencode({'token': token})}"
    return send_email(
        to_email,
        "Reset your Task Manager password",
        (
            f"Hi {username},\n\n"
            "A password reset was requested for your Task Manager account.\n\n"
            f"Reset your password here: {reset_url}\n\n"
            f"This link expires in {expires_minutes} minutes and can only be used once. "
            "If you did not request a reset, you can ignore this email.\n\n"
            "Task Manager"
        ),
    )


def send_password_changed_email(to_email: str, username: str) -> bool:
    return send_email(
        to_email,
        "Your Task Manager password was changed",
        f"Hi {username},\n\nYour password was changed successfully. If you did not make this change, contact support immediately.\n\nTask Manager",
    )


def send_email_changed_messages(old_email: str, new_email: str, username: str) -> None:
    send_email(
        old_email,
        "Your Task Manager email address was changed",
        f"Hi {username},\n\nYour account email was changed to {new_email}. If you did not make this change, contact support immediately.\n\nTask Manager",
    )
    send_email(
        new_email,
        "Your new Task Manager email is active",
        f"Hi {username},\n\nThis email address is now connected to your Task Manager account.\n\nTask Manager",
    )


def send_account_deleted_email(to_email: str, username: str) -> bool:
    return send_email(
        to_email,
        "Your Task Manager account was deleted",
        f"Hi {username},\n\nYour Task Manager account and associated application data were deleted.\n\nTask Manager",
    )


def send_contact_notifications(first_name: str, last_name: str, email: str, phone: str, message_text: str) -> None:
    if ADMIN_EMAIL:
        send_email(
            ADMIN_EMAIL,
            f"New Task Manager contact message from {first_name} {last_name}",
            f"Name: {first_name} {last_name}\nEmail: {email}\nPhone: {phone}\n\nMessage:\n{message_text}",
            reply_to=email,
        )
    send_email(
        email,
        "We received your Task Manager message",
        f"Hi {first_name},\n\nThanks for contacting Task Manager. Your message was received and we'll respond as soon as possible.\n\nTask Manager",
    )
