import pandas as pd
import os
from typing import List, Dict

class DataLoader:
    def __init__(self, public_data_dir: str = "./data/public", users_data_dir: str = "./data/users"):
        self.public_data_dir = public_data_dir
        self.users_data_dir = users_data_dir

    def _get_tickers_from_dir(self, directory: str) -> List[str]:
        tickers = []
        if not os.path.exists(directory):
            return tickers
        for file in os.listdir(directory):
            if file.endswith("_raw.csv"):
                tickers.append(file.replace("_raw.csv", ""))
            elif file.endswith(".csv") and not "processed" in file:
                tickers.append(file.replace(".csv", ""))
        return tickers

    def get_available_tickers(self, username: str = None) -> List[str]:
        public_tickers = self._get_tickers_from_dir(self.public_data_dir)
        user_tickers = []
        if username:
            user_dir = os.path.join(self.users_data_dir, username)
            if os.path.exists(user_dir):
                user_tickers = self._get_tickers_from_dir(user_dir)
        
        # Combine unique tickers
        return sorted(list(set(public_tickers + user_tickers)))

    def load_data(self, stock_name: str, username: str = None) -> pd.DataFrame:
        # Check user directory first if username is provided
        file_path = None
        
        if username:
            user_dir = os.path.join(self.users_data_dir, username)
            potential_paths = [
                os.path.join(user_dir, f"{stock_name}_raw.csv"),
                os.path.join(user_dir, f"{stock_name}.csv")
            ]
            for p in potential_paths:
                if os.path.exists(p):
                    file_path = p
                    break
        
        # If not found in user dir, check public dir
        if not file_path:
            potential_paths = [
                os.path.join(self.public_data_dir, f"{stock_name}_raw.csv"),
                os.path.join(self.public_data_dir, f"{stock_name}.csv")
            ]
            for p in potential_paths:
                if os.path.exists(p):
                    file_path = p
                    break
        
        if not file_path:
             raise ValueError(f"Stock {stock_name} not found.")

        df = pd.read_csv(file_path)
        return df

    def save_user_file(self, username: str, filename: str, content: bytes):
        user_dir = os.path.join(self.users_data_dir, username)
        os.makedirs(user_dir, exist_ok=True)
        file_path = os.path.join(user_dir, filename)
        with open(file_path, "wb") as f:
            f.write(content)
        return filename.replace(".csv", "").replace("_raw", "")
