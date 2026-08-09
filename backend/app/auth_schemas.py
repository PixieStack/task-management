from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class VerificationRequest(BaseModel):
    email: EmailStr


class OAuthCredential(BaseModel):
    provider: Literal["google", "apple"]
    credential: str = Field(min_length=20, max_length=8192)


class RegistrationResponse(BaseModel):
    message: str
    email: EmailStr


class OAuthConfigResponse(BaseModel):
    google_client_id: str | None = None
    apple_client_id: str | None = None
