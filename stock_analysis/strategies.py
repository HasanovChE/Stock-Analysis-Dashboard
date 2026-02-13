import pandas as pd
import numpy as np

class StrategyEngine:
    @staticmethod
    def generate_signals(df: pd.DataFrame) -> pd.DataFrame:
        """
        Generate buy/sell signals based on multiple technical indicators.
        1: Strong Buy, -1: Strong Sell, 0: Neutral
        """
        df['Signal'] = 0
        
        # 1. RSI Signals (Overbought/Oversold)
        rsi_col = next((c for c in df.columns if 'RSI' in c), None)
        if rsi_col:
            df.loc[df[rsi_col] < 30, 'Signal'] += 1
            df.loc[df[rsi_col] > 70, 'Signal'] -= 1
            
        # 2. Moving Average Crossover
        ma_cols = [c for c in df.columns if 'MA' in c or 'EMA' in c]
        if len(ma_cols) >= 2:
            # Simple fast vs slow crossover logic
            df.loc[df[ma_cols[0]] > df[ma_cols[1]], 'Signal'] += 1
            df.loc[df[ma_cols[0]] < df[ma_cols[1]], 'Signal'] -= 1
            
        # 3. Bollinger Bands
        bb_upper = next((c for c in df.columns if 'Upper_BB' in c), None)
        bb_lower = next((c for c in df.columns if 'Lower_BB' in c), None)
        if bb_upper and bb_lower:
            df.loc[df['Close'] < df[bb_lower], 'Signal'] += 1
            df.loc[df['Close'] > df[bb_upper], 'Signal'] -= 1
            
        # 4. MACD
        if 'MACD' in df.columns and 'MACD_Signal' in df.columns:
            df.loc[df['MACD'] > df['MACD_Signal'], 'Signal'] += 1
            df.loc[df['MACD'] < df['MACD_Signal'], 'Signal'] -= 1
            
        # Normalize signal to [-1, 1] range qualitatively
        df['Advice'] = 'Neutral'
        df.loc[df['Signal'] >= 2, 'Advice'] = 'Strong Buy'
        df.loc[df['Signal'] == 1, 'Advice'] = 'Buy'
        df.loc[df['Signal'] == -1, 'Advice'] = 'Sell'
        df.loc[df['Signal'] <= -2, 'Advice'] = 'Strong Sell'
        
        return df
