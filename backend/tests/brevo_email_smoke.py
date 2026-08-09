from email.utils import parseaddr

from app import email_service


class FakeSMTP:
    instances = []

    def __init__(self, host, port, timeout):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.ehlo_calls = 0
        self.started_tls = False
        self.login_args = None
        self.message = None
        FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def ehlo(self):
        self.ehlo_calls += 1

    def starttls(self):
        self.started_tls = True

    def login(self, username, password):
        self.login_args = (username, password)

    def send_message(self, message):
        self.message = message


email_service.BREVO_SMTP_SERVER = "smtp-relay.brevo.com"
email_service.BREVO_SMTP_PORT = 587
email_service.BREVO_SMTP_LOGIN = "ci-smtp-login"
email_service.BREVO_SMTP_KEY = "ci-smtp-key"
email_service.SENDER_EMAIL = "verified-sender@example.com"
email_service.SENDER_NAME = "M.O.B TaskManager"
email_service.API_PUBLIC_URL = "https://api.example.test"
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

print("Brevo SMTP verification transport smoke test passed")
