import pandas as pd
import os

class DataLoader:
    def __init__(self, data_dir: str = "."):
        self.data_dir = data_dir
        self.tickers = {}
        self.refresh_tickers()

    def refresh_tickers(self):
        self.tickers = {}
        for file in os.listdir(self.data_dir):
            if file.endswith("_raw.csv"):
                ticker_name = file.replace("_raw.csv", "")
                self.tickers[ticker_name] = ticker_name
            elif file.endswith(".csv") and not file.endswith("_processed.csv"):
                ticker_name = file.replace(".csv", "")
                self.tickers[ticker_name] = ticker_name

    def load_data(self, stock_name: str) -> pd.DataFrame:
        if stock_name not in self.tickers:
            self.refresh_tickers()
            if stock_name not in self.tickers:
                raise ValueError(f"Stock {stock_name} not found. Available: {list(self.tickers.keys())}")
        
        ticker = self.tickers[stock_name]
        
        file_path_raw = os.path.join(self.data_dir, f"{ticker}_raw.csv")
        file_path_direct = os.path.join(self.data_dir, f"{ticker}.csv")
        
        if os.path.exists(file_path_raw):
            file_path = file_path_raw
        elif os.path.exists(file_path_direct):
            file_path = file_path_direct
        else:
             raise FileNotFoundError(f"File not found for {ticker}")
             
        df = pd.read_csv(file_path)
        
       
        return df

    def add_ticker(self, name: str, file_name: str):
        self.tickers[name] = name
