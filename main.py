from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from stock_analysis import DataLoader, TechnicalIndicators
import pandas as pd
import numpy as np
import json
import os
import io
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

data_loader = DataLoader(data_dir=".")

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_root():
    """Serve the main dashboard page."""
    return FileResponse("static/index.html")

@app.get("/api/stocks")
def get_stocks():
    """Return available stock options."""
    data_loader.refresh_tickers()
    return {"stocks": list(data_loader.tickers.keys())}

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
    end_date: str = Query(None)
):
    try:
        df = data_loader.load_data(stock)
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
async def upload_csv(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(".", file.filename)
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        data_loader.refresh_tickers()
        ticker_name = file.filename.replace('.csv', '').replace('_raw', '')
        return {"message": "Success", "ticker": ticker_name}
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
    end_date: str = Query(None)
):
    try:
        df = data_loader.load_data(stock)
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
