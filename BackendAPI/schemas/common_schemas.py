from pydantic import BaseModel
from uuid import UUID

class RequestBodyIdAndQuantity(BaseModel): 
  id : UUID | str
  quantity : int
  # user_id : str

class RequestBodyIdUserIdAndQuantity(BaseModel): 
  id : UUID | str
  quantity : int
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
  page: int