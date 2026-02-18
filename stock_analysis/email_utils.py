import requests
import json

# Mailtrap Configuration - Transactional/Sending API
MAILTRAP_TOKEN = "4a5112506950745eb044efdfe5f585c5"
# For real delivery to your inbox using Mailtrap's demo domain:
SENDER_EMAIL = "hello@demomailtrap.co" 
SENDER_NAME = "Stock Analysis Dashboard"

# Transactional API endpoint for real delivery
TRANSACTIONAL_URL = "https://send.api.mailtrap.io/api/send"

def send_reset_email(to_email: str, code: str):
    """
    Sends a password reset code to your real email inbox using Mailtrap's Sending API.
    Note: The demo domain (demomailtrap.co) only allows sending to the address 
    associated with your Mailtrap account.
    """
    payload = {
        "from": {"email": SENDER_EMAIL, "name": SENDER_NAME},
        "to": [{"email": to_email}],
        "subject": "Password Reset Code",
        "text": f"Greetings,\n\nYour password reset code is: {code}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this, please ignore this email.",
        "category": "Password Reset"
    }
    
    headers = {
        "Authorization": f"Bearer {MAILTRAP_TOKEN}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(TRANSACTIONAL_URL, json=payload, headers=headers)
        if response.status_code == 200 or response.status_code == 202:
            print(f"Email sent successfully to {to_email}")
            return True
        else:
            print(f"Failed to send real email: {response.status_code} - {response.text}")
            
            # Fallback to Sandbox if Transactional fails (e.g. if sending to a non-authorized email)
            print("Attempting fallback to Sandbox...")
            sandbox_url = "https://sandbox.api.mailtrap.io/api/send/4392723"
            requests.post(sandbox_url, json=payload, headers=headers)
            
            return False
    except Exception as e:
        print(f"Error sending email: {e}")
        return False
