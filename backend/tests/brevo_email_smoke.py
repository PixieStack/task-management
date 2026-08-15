from email.utils import parseaddr
import ssl

from app import email_service


class FakeSMTP:
    instances = []

    def __init__(self, host, port, timeout):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.ehlo_calls = 0
        self.started_tls = False
        self.tls_context = None
        self.login_args = None
        self.message = None
        FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def ehlo(self):
        self.ehlo_calls += 1

    def starttls(self, context=None):
        self.started_tls = True
        self.tls_context = context

    def login(self, username, password):
        self.login_args = (username, password)

    def send_message(self, message):
        self.message = message

class FakeResponse:
    def raise_for_status(self):
        return None



email_service.BREVO_SMTP_SERVER = "smtp-relay.brevo.com"
email_service.BREVO_SMTP_PORT = 587
email_service.BREVO_SMTP_LOGIN = "ci-smtp-login"
email_service.BREVO_SMTP_KEY = "ci-smtp-key"
email_service.SENDER_EMAIL = "verified-sender@example.com"
email_service.SENDER_NAME = "M.O.B TaskManager"
email_service.API_PUBLIC_URL = "https://api.example.test"
email_service.BREVO_SMTP_LOGIN = ""
email_service.BREVO_SMTP_KEY = ""
api_calls = []
email_service.BREVO_API_KEY = "ci-api-key"
email_service.httpx.post = lambda url, **kwargs: api_calls.append((url, kwargs)) or FakeResponse()

api_sent = email_service.send_verification_email(
    "api-user@example.com",
    "API User",
    "api-verification-token",
    60,
)
assert api_sent is True
assert len(api_calls) == 1
api_url, api_request = api_calls[0]
assert api_url == "https://api.brevo.com/v3/smtp/email"
assert api_request["headers"]["api-key"] == "ci-api-key"
assert api_request["json"]["sender"]["email"] == "verified-sender@example.com"
assert api_request["json"]["to"] == [{"email": "api-user@example.com"}]
assert api_request["json"]["subject"] == "Verify your M.O.B TaskManager email"
assert "api-verification-token" in api_request["json"]["textContent"]
email_service.BREVO_API_KEY = ""
email_service.BREVO_SMTP_LOGIN = "ci-smtp-login"
email_service.BREVO_SMTP_KEY = "ci-smtp-key"

email_service.smtplib.SMTP = FakeSMTP

sent = email_service.send_verification_email(
    "new-user@example.com",
    "New User",
    "verification-token-value",
    60,
)
assert sent is True
assert len(FakeSMTP.instances) == 1
smtp = FakeSMTP.instances[0]
assert smtp.host == "smtp-relay.brevo.com"
assert smtp.port == 587
assert smtp.started_tls is True
assert isinstance(smtp.tls_context, ssl.SSLContext)
assert smtp.ehlo_calls == 2
assert smtp.login_args == ("ci-smtp-login", "ci-smtp-key")
assert smtp.message is not None
assert smtp.message["To"] == "new-user@example.com"
sender_name, sender_address = parseaddr(str(smtp.message["From"]))
assert sender_name == "M.O.B TaskManager"
assert sender_address == "verified-sender@example.com"
assert smtp.message["Subject"] == "Verify your M.O.B TaskManager email"
body = smtp.message.get_body(preferencelist=("plain",)).get_content()
assert "https://api.example.test/auth/verify-email?token=verification-token-value" in body
assert "expires in 60 minutes" in body

habit_sent = email_service.send_habit_completion_email(
    "new-user@example.com",
    "New User",
    "Read before bed",
    30,
)
assert habit_sent is True
assert len(FakeSMTP.instances) == 2
habit_message = FakeSMTP.instances[1].message
assert habit_message["Subject"] == "You completed your 30-day habit!"
habit_body = habit_message.get_body(preferencelist=("plain",)).get_content()
assert "Read before bed" in habit_body
assert "30 daily check-ins" in habit_body

print("Brevo SMTP verification and habit completion transport smoke test passed")
