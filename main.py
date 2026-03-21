from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from stock_analysis.data_loader import DataLoader
from stock_analysis.indicators import TechnicalIndicators
from stock_analysis.models import User, UserCreate, Token, UserInDB, ForgotPasswordRequest, ResetPasswordRequest
from stock_analysis.auth import UserManager, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY, ALGORITHM
from jose import JWTError, jwt
from datetime import timedelta
import pandas as pd
import numpy as np
import json
import os
import io
import requests
from stock_analysis.email_utils import send_reset_email

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
user_manager = UserManager()

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = user_manager.get_user(username)
    if user is None:
        raise credentials_exception
    return user

data_loader = DataLoader(public_data_dir="./data/public", users_data_dir="./data/users")

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.post("/register", response_model=User)
async def register(user: UserCreate):
    try:
        if user_manager.get_user(user.username):
            raise HTTPException(status_code=400, detail="Username already registered")
        created_user = user_manager.create_user(user)
        return User(username=created_user.username, email=created_user.email, disabled=created_user.disabled)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    user = user_manager.get_user_by_email(request.email)
    if not user:
        # For security, don't reveal if user exists, but here we'll be helpful
        raise HTTPException(status_code=404, detail="User with this email not found")
    
    code = user_manager.generate_reset_code(request.email)
    
    # Send actual email via Mailtrap
    success = send_reset_email(request.email, code)
    
    # Always print to terminal for debugging as well
    print(f"\n--- RESET CODE GENERATED ---")
    print(f"To: {request.email}")
    print(f"Code: {code}")
    print(f"Email Sent Status: {'Success' if success else 'Failed'}")
    print(f"----------------------------\n")
    
    if not success:
        # We still return success to the user so they can use the code from terminal if needed
        # but we could also raise an error. Given the "demomailtrap.com" restriction,
        # it might fail frequently if not configured with a real domain.
        return {"message": "Reset code generated. (Check terminal if email delivery fails)"}
    
    return {"message": "Reset code sent to your email"}

@app.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    if not user_manager.verify_reset_code(request.email, request.code):
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    
    try:
        user_manager.reset_password(request.email, request.new_password)
        return {"message": "Password reset successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = user_manager.get_user(form_data.username)
    if not user or not user_manager.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/")
async def read_root():
    """Serve the main dashboard page."""
    return FileResponse("static/index.html")

@app.get("/api/stocks")
def get_stocks(current_user: User = Depends(get_current_user)):
    """Return available stock options for the current user."""
    stocks = data_loader.get_available_tickers(current_user.username)
    return {"stocks": stocks}

@app.get("/api/analyze")
def analyze_stock(
    stock: str = Query(..., description="Stock name"),
    ma_window: int = Query(30, ge=1, le=200),
    rsi_window: int = Query(14, ge=1, le=100),
    ema_span: int = Query(14, ge=1, le=200),
    bb_window: int = Query(20, ge=1, le=200),
    bb_std: float = Query(2.0, ge=0.1, le=10.0),
    atr_window: int = Query(14, ge=1, le=100),
    sma_window: int = Query(20, ge=1, le=200),
    std_window: int = Query(20, ge=1, le=200),
    macd_fast: int = Query(12, ge=1, le=100),
    macd_slow: int = Query(26, ge=1, le=100),
    macd_signal: int = Query(9, ge=1, le=100),
    start_date: str = Query(None),
    end_date: str = Query(None),
    current_user: User = Depends(get_current_user)
):
    try:
        df = data_loader.load_data(stock, current_user.username)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

    date_col = next((c for c in df.columns if c.lower() == 'date'), None)

    if date_col:
        df[date_col] = pd.to_datetime(df[date_col])
        if start_date:
            df = df[df[date_col] >= pd.to_datetime(start_date)]
        if end_date:
            df = df[df[date_col] <= pd.to_datetime(end_date)]
        df.sort_values(date_col, inplace=True)
        df['Date'] = df[date_col].dt.strftime('%Y-%m-%d')

    df = TechnicalIndicators.add_ma(df, window=ma_window)
    df = TechnicalIndicators.add_rsi(df, window=rsi_window)
    df = TechnicalIndicators.add_ema(df, span=ema_span)
    df = TechnicalIndicators.add_bollinger_bands(df, window=bb_window, num_std=bb_std)
    df = TechnicalIndicators.add_macd(df, fast=macd_fast, slow=macd_slow, signal=macd_signal)
    df = TechnicalIndicators.add_atr(df, window=atr_window)
    df = TechnicalIndicators.add_sma(df, window=sma_window)
    df = TechnicalIndicators.add_std(df, window=std_window)

    df = df.replace([np.inf, -np.inf], np.nan).fillna(value=np.nan)
    data_records = json.loads(df.to_json(orient='records'))
    
    return {"stock": stock, "data": data_records}

@app.post("/api/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    try:
        content = await file.read()
        saved_name = data_loader.save_user_file(current_user.username, file.filename, content)
        return {"message": "Success", "ticker": saved_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/export-csv")
def export_csv(
    stock: str = Query(...),
    ma_window: int = Query(30), rsi_window: int = Query(14),
    ema_span: int = Query(14), bb_window: int = Query(20),
    bb_std: float = Query(2.0), atr_window: int = Query(14),
    sma_window: int = Query(20), std_window: int = Query(20),
    macd_fast: int = Query(12), macd_slow: int = Query(26),
    macd_signal: int = Query(9), start_date: str = Query(None),
    end_date: str = Query(None),
    current_user: User = Depends(get_current_user)
):
    try:
        df = data_loader.load_data(stock, current_user.username)
        date_col = next((c for c in df.columns if c.lower() == 'date'), None)
        if date_col and (start_date or end_date):
            df[date_col] = pd.to_datetime(df[date_col])
            if start_date: df = df[df[date_col] >= pd.to_datetime(start_date)]
            if end_date: df = df[df[date_col] <= pd.to_datetime(end_date)]

        df = TechnicalIndicators.add_ma(df, window=ma_window)
        df = TechnicalIndicators.add_rsi(df, window=rsi_window)
        df = TechnicalIndicators.add_ema(df, span=ema_span)
        df = TechnicalIndicators.add_bollinger_bands(df, window=bb_window, num_std=bb_std)
        df = TechnicalIndicators.add_macd(df, fast=macd_fast, slow=macd_slow, signal=macd_signal)
        df = TechnicalIndicators.add_atr(df, window=atr_window)
        df = TechnicalIndicators.add_sma(df, window=sma_window)
        df = TechnicalIndicators.add_std(df, window=std_window)
        
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)
        
        filename = f"{stock}_processed.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
