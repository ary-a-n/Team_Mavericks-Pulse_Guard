from datetime import datetime
from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str
class PatientCreate(BaseModel):
    name: str
    bed_number: str | None = None
    age: int | None = None
    admission_reason: str | None = None
    status: str | None = None

class PatientResponse(PatientCreate):
    id: int
    created_at: datetime
    class Config: from_attributes = True
