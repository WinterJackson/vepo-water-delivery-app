from pydantic import BaseModel, Field
from uuid import UUID

class RequestBodyIdAndQuantity(BaseModel): 
  id : UUID | str
  quantity : int = Field(gt=0, le=500, description="Must be a positive integer, capped to prevent abuse")
  # user_id : str

class RequestBodyIdUserIdAndQuantity(BaseModel): 
  id : UUID | str
  quantity : int = Field(gt=0, le=500)
  user_id : str

class RequestBodyIdAndType(BaseModel): 
  id : UUID | str
  type : str
  # clerk_id : str

class RequestBodyId(BaseModel): 
  id : UUID | str
  # clerk_id : str

class RequestBodyProfilePic(BaseModel): 
  profile_pic : str
  # clerk_id : str

class RequestBodyPage(BaseModel):
  page: int = Field(ge=1, description="1-indexed page number")