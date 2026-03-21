import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# read from .env
load_dotenv()

# ─────────────────────────────────────────────────────────────
GMAIL_ADDRESS  = os.getenv("GMAIL_USER")   # read from .env  
GMAIL_APP_PASS = os.getenv("GMAIL_PASS")   # read from .env
SENDER_NAME    = "Stock Analysis Dashboard"

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


def send_reset_email(to_email: str, code: str) -> bool:
    """
    Sends a password reset code to ANY email address via Gmail SMTP.
    Works for all recipients, not restricted to a specific domain.
    """
    try:
        # Build the email
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Password Reset Code"
        msg["From"]    = f"{SENDER_NAME} <{GMAIL_ADDRESS}>"
        msg["To"]      = to_email

        plain_text = (
            f"Greetings,\n\n"
            f"Your password reset code is: {code}\n\n"
            f"This code will expire in 10 minutes.\n\n"
            f"If you did not request this, please ignore this email."
        )

        html_text = f"""\
        <html>
          <body style="font-family: Arial, sans-serif; background: #0d1117; color: #e6edf3; padding: 30px;">
            <div style="max-width: 480px; margin: auto; background: #161b22; border-radius: 10px; padding: 30px; border: 1px solid #30363d;">
              <h2 style="color: #58a6ff; margin-top: 0;">Stock Analysis Dashboard</h2>
              <p>Greetings,</p>
              <p>Your password reset code is:</p>
              <div style="font-size: 2rem; font-weight: bold; letter-spacing: 8px; text-align: center;
                          background: #21262d; padding: 16px; border-radius: 8px; color: #f0f6fc; margin: 20px 0;">
                {code}
              </div>
              <p style="color: #8b949e; font-size: 0.85rem;">
                This code expires in <strong>10 minutes</strong>.<br>
                If you did not request a password reset, please ignore this email.
              </p>
            </div>
          </body>
        </html>
        """

        msg.attach(MIMEText(plain_text, "plain"))
        msg.attach(MIMEText(html_text, "html"))

        # Send via Gmail SMTP
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(GMAIL_ADDRESS, GMAIL_APP_PASS)
            server.sendmail(GMAIL_ADDRESS, to_email, msg.as_string())

        print(f"[Gmail] Email sent successfully to {to_email}")
        return True

    except smtplib.SMTPAuthenticationError:
        print("[Gmail] Authentication failed — check GMAIL_ADDRESS and GMAIL_APP_PASS.")
        print("[Gmail] Make sure you are using an App Password, not your regular Gmail password.")
        print("[Gmail] Generate one at: https://myaccount.google.com/apppasswords")
        return False
    except smtplib.SMTPException as e:
        print(f"[Gmail] SMTP error: {e}")
        return False
    except Exception as e:
        print(f"[Gmail] Unexpected error: {e}")
        return False
