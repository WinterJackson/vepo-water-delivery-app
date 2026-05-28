from fastapi import Depends , HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.security import verify_clerk_token

security = HTTPBearer()

async def get_current_user(
  credentials : HTTPAuthorizationCredentials = Depends(security)
):
  token = credentials.credentials
  try:
    user_data = await verify_clerk_token(token)
  except Exception:
    raise HTTPException(status_code=401, detail="Invalid or Expired token")
  if not user_data: 
    raise HTTPException(status_code=401, detail="Invalid or Expired token")
  return user_data


# how to use 

# @router.get("/protected")
# async def protected_route(user=Depends(get_current_user)):
#     return {"email": user["email"], "id": user["sub"]}