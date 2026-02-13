from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
import json
import os
from .models import User, UserInDB, UserCreate

# Secret key for JWT encoding/decoding
SECRET_KEY = "supersecretkey" # Ideally, load from env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserManager:
    def __init__(self, db_file="users.json"):
        self.db_file = db_file
        self.users_db = {}
        self._load_users()

    def _load_users(self):
        if os.path.exists(self.db_file):
            try:
                with open(self.db_file, "r") as f:
                    data = json.load(f)
                    self.users_db = {u["username"]: UserInDB(**u) for u in data}
            except json.JSONDecodeError:
                self.users_db = {}
        else:
            self.users_db = {}

    def _save_users(self):
        with open(self.db_file, "w") as f:
            data = [u.dict() for u in self.users_db.values()]
            json.dump(data, f, indent=4)

    def get_user(self, username: str) -> Optional[UserInDB]:
        return self.users_db.get(username)

    def create_user(self, user: UserCreate) -> UserInDB:
        if user.username in self.users_db:
            raise ValueError("User already exists")
        hashed_password = pwd_context.hash(user.password)
        db_user = UserInDB(username=user.username, hashed_password=hashed_password, disabled=False)
        self.users_db[user.username] = db_user
        self._save_users()
        return db_user

    def verify_password(self, plain_password, hashed_password):
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password):
        return pwd_context.hash(password)

user_manager = UserManager()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
