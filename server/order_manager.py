import os
import json
import portalocker
from datetime import datetime
from typing import Dict, Any, List, Optional

from order_status import OrderStatus

class OrderManager:
    def __init__(self, strategy_name: str, base_dir='.', logging=False):
        self.strategy_name = strategy_name
        self.logging = logging
        script_dir = os.path.dirname(os.path.abspath(__file__))
        self.base_dir = os.path.join(script_dir, base_dir)
        self.ensure_base_dir()
        self.trades_file = f"TRADES_LOG_{self.strategy_name}.json"
        self.ensure_json_file()
        if self.logging:
            print(f"Initialized OrderManager for strategy: {self.strategy_name}")

    def ensure_base_dir(self):
        if not os.path.exists(self.base_dir):
            os.makedirs(self.base_dir)
            if self.logging:
                print(f"Created base directory: {self.base_dir}")

    def ensure_json_file(self):
        trades_path = self.get_trades_file_path()
        if not os.path.exists(trades_path):
            with open(trades_path, 'w') as f:
                json.dump([], f)
            if self.logging:
                print(f"Created new trades file: {trades_path}")

    def get_trades_file_path(self) -> str:
        return os.path.join(self.base_dir, self.trades_file)

    def read_file_with_lock(self) -> List[Dict[str, Any]]:
        file_path = self.get_trades_file_path()
        if self.logging:
            print(f"Reading trades from file: {file_path}")
        with portalocker.Lock(file_path, 'r', timeout=10) as file:
            try:
                return json.load(file)
            except json.JSONDecodeError:
                if self.logging:
                    print("Failed to decode JSON, returning empty list.")
                return []

    def write_file_with_lock(self, data: List[Dict[str, Any]]):
        file_path = self.get_trades_file_path()
        if self.logging:
            print(f"Writing {len(data)} trades to file: {file_path}")
        with portalocker.Lock(file_path, 'w', timeout=10) as file:
            json.dump(data, file, indent=4)

    def update_order(self, symbol: str, data: Dict[str, Any]) -> None:
        if self.logging:
            print(f"Updating order for symbol: {symbol}")
        trades = self.read_file_with_lock()
        order_index = next((index for (index, d) in enumerate(trades) if d["symbol"] == symbol), None)

        if order_index is not None:
            trades[order_index].update(data)
            if self.logging:
                print(f"Updated existing order for symbol: {symbol}")
        else:
            trades.append(data)
            if self.logging:
                print(f"Added new order for symbol: {symbol}")

        self.write_file_with_lock(trades)

    def exit_order(self, symbol: str) -> None:
        if self.logging:
            print(f"Exiting order for symbol: {symbol}")
        trades = self.read_file_with_lock()
        for trade in trades:
            if trade['symbol'] == symbol:
                trade['status'] = OrderStatus.EXITED.value        
                trade['exitDatetime'] = datetime.now().isoformat()
                if self.logging:
                    print(f"Marked order as exited for symbol: {symbol}")
                break
            
        self.write_file_with_lock(trades)
        
    def get_order(self, symbol: str) -> Optional[Dict[str, Any]]:
        if self.logging:
            print(f"Retrieving order for symbol: {symbol}")
        trades = self.read_file_with_lock()
        return next((trade for trade in trades if trade['symbol'] == symbol), None)

    def list_orders(self, status: Optional[OrderStatus] = None) -> List[Dict[str, Any]]:
        if self.logging:
            print(f"Listing orders with status: {status}")
        trades = self.read_file_with_lock()
        if status:
            return [trade for trade in trades if trade['status'] == status.value]
        return trades

    def list_active_trades(self) -> List[Dict[str, Any]]:
        if self.logging:
            print("Listing all active trades")
        return self.list_orders(OrderStatus.ACTIVE)

    def list_completed_trades(self) -> List[Dict[str, Any]]:
        if self.logging:
            print("Listing all completed trades")
        return self.list_orders(OrderStatus.EXITED)

    def delete_order(self, symbol: str):
        """Delete a single order by symbol."""
        trades = self.read_file_with_lock()
        trades = [trade for trade in trades if trade['symbol'] != symbol]
        self.write_file_with_lock(trades)
        if self.logging:
            print(f"Deleted order with symbol: {symbol}")

    def delete_all_completed_orders(self):
        """Delete all orders with EXITED status."""
        trades = self.read_file_with_lock()
        trades = [trade for trade in trades if trade['status'] != OrderStatus.EXITED.value]
        self.write_file_with_lock(trades)
        if self.logging:
            print("Deleted all exited orders")