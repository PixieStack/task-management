from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from app import models, schemas
from app.auth import get_db, get_current_user

router = APIRouter(prefix="/contact", tags=["contact"])

# Email configuration (you can move these to environment variables)
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
EMAIL_USERNAME = os.getenv("EMAIL_USERNAME", "your-email@gmail.com")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "your-app-password")
NOTIFICATION_EMAIL = "thwalathembinkosi16@gmail.com"

@router.post("/", response_model=schemas.ContactMessageResponse, status_code=status.HTTP_201_CREATED)
async def submit_contact_message(
    contact_data: schemas.ContactMessageCreate,
    db: Session = Depends(get_db)
):
    """Submit a contact message and send email notification"""
    try:
        # Create contact message in database
        db_contact = models.ContactMessage(
            first_name=contact_data.firstName,
            last_name=contact_data.lastName,
            email=contact_data.email,
            phone=contact_data.phone,
            message=contact_data.message
        )
       
        db.add(db_contact)
        db.commit()
        db.refresh(db_contact)
       
        # Send email notification
        email_sent = await send_email_notification(contact_data)
       
        if not email_sent:
            # Still return success even if email fails
            print("Warning: Email notification failed to send")
       
        return schemas.ContactMessageResponse(
            success=True,
            message="Thank you for your message! We'll get back to you within 24 hours.",
            contact_id=db_contact.id
        )
       
    except Exception as e:
        db.rollback()
        print(f"Error processing contact message: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit contact message. Please try again later."
        )

async def send_email_notification(contact_data: schemas.ContactMessageCreate) -> bool:
    """Send email notification to your email address"""
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = EMAIL_USERNAME
        msg['To'] = NOTIFICATION_EMAIL
        msg['Subject'] = f"New Contact Form Submission from {contact_data.firstName} {contact_data.lastName}"
       
        # Email body
        body = f"""
        New contact form submission received:
       
        Name: {contact_data.firstName} {contact_data.lastName}
        Email: {contact_data.email}
        Phone: {contact_data.phone}
       
        Message:
        {contact_data.message}
       
        Submitted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        """
       
        msg.attach(MIMEText(body, 'plain'))
       
        # Send email
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
        text = msg.as_string()
        server.sendmail(EMAIL_USERNAME, NOTIFICATION_EMAIL, text)
        server.quit()
       
        print(f"Email notification sent successfully to {NOTIFICATION_EMAIL}")
        return True
       
    except Exception as e:
        print(f"Failed to send email notification: {str(e)}")
        return False

# Admin endpoints (protected)
@router.get("/messages", response_model=List[schemas.ContactMessageOut])
def get_contact_messages(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all contact messages (admin only)"""
    # You might want to add admin role checking here
    messages = db.query(models.ContactMessage).offset(skip).limit(limit).all()
    return messages

@router.patch("/messages/{message_id}/read")
def mark_message_as_read(
    message_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a contact message as read (admin only)"""
    message = db.query(models.ContactMessage).filter(models.ContactMessage.id == message_id).first()
   
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
   
    message.is_read = True
    message.updated_at = datetime.utcnow()
   
    db.commit()
   
    return {"success": True, "message": "Message marked as read"}

@router.delete("/messages/{message_id}")
def delete_contact_message(
    message_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a contact message (admin only)"""
    message = db.query(models.ContactMessage).filter(models.ContactMessage.id == message_id).first()
   
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
   
    db.delete(message)
    db.commit()
   
    return {"success": True, "message": "Contact message deleted"}