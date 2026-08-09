from pydantic import BaseModel, EmailStr


class VerificationRequest(BaseModel):
    email: EmailStr


class RegistrationResponse(BaseModel):
    message: str
    email: EmailStr
