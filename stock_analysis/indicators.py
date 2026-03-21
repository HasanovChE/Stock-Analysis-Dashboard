import pandas as pd
import numpy as np

class TechnicalIndicators:
    @staticmethod
    def add_ma(df: pd.DataFrame, window: int = 30) -> pd.DataFrame:
        df[f'MA_{window}'] = df['Close'].rolling(window).mean()
        return df

    @staticmethod
    def add_ema(df: pd.DataFrame, span: int = 14) -> pd.DataFrame:
        df[f'EMA_{span}'] = df['Close'].ewm(span=span, adjust=False).mean()
        return df

    @staticmethod
    def add_rsi(df: pd.DataFrame, window: int = 14) -> pd.DataFrame:
        delta = df['Close'].diff()
        gain = delta.where(delta > 0, 0)
        loss = -delta.where(delta < 0, 0)
        
        avg_gain = gain.rolling(window).mean()
        avg_loss = loss.rolling(window).mean()
        
        rs = avg_gain / avg_loss
        df[f'RSI_{window}'] = 100 - (100 / (1 + rs))
        return df

    @staticmethod
    def add_macd(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
        ema_fast = df['Close'].ewm(span=fast, adjust=False).mean()
        ema_slow = df['Close'].ewm(span=slow, adjust=False).mean()
        df['MACD'] = ema_fast - ema_slow
        df['MACD_Signal'] = df['MACD'].ewm(span=signal, adjust=False).mean()
        return df

    @staticmethod
    def add_atr(df: pd.DataFrame, window: int = 14) -> pd.DataFrame:
        high_low = df['High'] - df['Low']
        high_close = (df['High'] - df['Close'].shift()).abs()
        low_close = (df['Low'] - df['Close'].shift()).abs()
        
        true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        df[f'ATR_{window}'] = true_range.rolling(window).mean()
        return df

    @staticmethod
    def add_sma(df: pd.DataFrame, window: int = 20) -> pd.DataFrame:
        df[f'SMA_{window}'] = df['Close'].rolling(window).mean()
        return df

    @staticmethod
    def add_std(df: pd.DataFrame, window: int = 20) -> pd.DataFrame:
        df[f'STD_{window}'] = df['Close'].rolling(window).std()
        return df

    @staticmethod
    def add_bollinger_bands(df: pd.DataFrame, window: int = 20, num_std: float = 2.0) -> pd.DataFrame:
        sma = df['Close'].rolling(window).mean()
        std = df['Close'].rolling(window).std()
        df[f'SMA_{window}'] = sma
        df[f'STD_{window}'] = std
        df[f'Upper_BB_{window}'] = sma + (std * num_std)
        df[f'Lower_BB_{window}'] = sma - (std * num_std)
        return df
