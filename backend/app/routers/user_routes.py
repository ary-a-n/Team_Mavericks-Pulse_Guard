from fastapi import APIRouter, Depends
from app import models, schemas, auth

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

@router.get("/me", response_model=schemas.UserResponse)
def read_current_user(current_user: models.User = Depends(auth.get_current_user)):
    return current_user
