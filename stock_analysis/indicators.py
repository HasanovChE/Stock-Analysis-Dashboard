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

    @staticmethod
    def add_williams_r(df: pd.DataFrame, window: int = 14) -> pd.DataFrame:
        highest_high = df['High'].rolling(window).max()
        lowest_low = df['Low'].rolling(window).min()
        df[f'WilliamsR_{window}'] = ((highest_high - df['Close']) / (highest_high - lowest_low)) * -100
        return df

    @staticmethod
    def add_obv(df: pd.DataFrame) -> pd.DataFrame:
        obv = [0]
        for i in range(1, len(df)):
            if df['Close'][i] > df['Close'][i-1]:
                obv.append(obv[-1] + df['Volume'][i])
            elif df['Close'][i] < df['Close'][i-1]:
                obv.append(obv[-1] - df['Volume'][i])
            else:
                obv.append(obv[-1])
        df['OBV'] = obv
        return df

    @staticmethod
    def add_ichimoku(df: pd.DataFrame) -> pd.DataFrame:
        # Tenkan-sen (Conversion Line): (9-period high + 9-period low)/2
        nine_period_high = df['High'].rolling(window=9).max()
        nine_period_low = df['Low'].rolling(window=9).min()
        df['Tenkan_Sen'] = (nine_period_high + nine_period_low) / 2

        # Kijun-sen (Base Line): (26-period high + 26-period low)/2
        twenty_six_period_high = df['High'].rolling(window=26).max()
        twenty_six_period_low = df['Low'].rolling(window=26).min()
        df['Kijun_Sen'] = (twenty_six_period_high + twenty_six_period_low) / 2

        # Senkou Span A (Leading Span A): (Conversion Line + Base Line)/2
        df['Senkou_Span_A'] = ((df['Tenkan_Sen'] + df['Kijun_Sen']) / 2).shift(26)

        # Senkou Span B (Leading Span B): (52-period high + 52-period low)/2
        fifty_two_period_high = df['High'].rolling(window=52).max()
        fifty_two_period_low = df['Low'].rolling(window=52).min()
        df['Senkou_Span_B'] = ((fifty_two_period_high + fifty_two_period_low) / 2).shift(26)

        # Chikou Span (Lagging Span): Close plotted 26 days in the past
        df['Chikou_Span'] = df['Close'].shift(-26)
        return df
