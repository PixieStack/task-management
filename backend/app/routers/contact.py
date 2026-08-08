from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.orm import Session
from app import models, schemas
from app.auth import get_db
from app.email_service import send_contact_notifications

router = APIRouter(prefix="/api/contact", tags=["contact"])

@router.post("/", response_model=schemas.ContactMessageResponse, status_code=status.HTTP_201_CREATED)
def submit_contact_message(data: schemas.ContactMessageCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    obj = models.ContactMessage(first_name=data.firstName.strip(), last_name=data.lastName.strip(), email=data.email.lower(), phone=data.phone.strip(), message=data.message.strip())
    db.add(obj); db.commit(); db.refresh(obj)
    background_tasks.add_task(send_contact_notifications, data.firstName, data.lastName, data.email, data.phone, data.message)
    return schemas.ContactMessageResponse(success=True, message="Thank you for your message. We have received it.", contact_id=obj.id)
