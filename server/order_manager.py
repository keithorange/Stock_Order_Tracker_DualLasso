from flask import Flask, jsonify, request
import json
import os
import portalocker
from datetime import datetime
from enum import Enum
from typing import Dict, Any, List, Optional

from order_status import OrderStatus

class OrderManager:
    def __init__(self, strategy_name: str, base_dir='.'):
        self.strategy_name = strategy_name
        script_dir = os.path.dirname(os.path.abspath(__file__))
        self.base_dir = os.path.join(script_dir, base_dir)
        self.ensure_base_dir()
        self.trades_file = f"TRADES_LOG_{self.strategy_name}.json"
        self.ensure_json_file()

    def ensure_base_dir(self):
        if not os.path.exists(self.base_dir):
            os.makedirs(self.base_dir)

    def ensure_json_file(self):
        trades_path = self.get_trades_file_path()
        if not os.path.exists(trades_path):
            with open(trades_path, 'w') as f:
                json.dump([], f)

    def get_trades_file_path(self) -> str:
        return os.path.join(self.base_dir, self.trades_file)

    def read_file_with_lock(self) -> List[Dict[str, Any]]:
        file_path = self.get_trades_file_path()
        with portalocker.Lock(file_path, 'r', timeout=10) as file:
            try:
                return json.load(file)
            except json.JSONDecodeError:
                return []

    def write_file_with_lock(self, data: List[Dict[str, Any]]):
        file_path = self.get_trades_file_path()
        with portalocker.Lock(file_path, 'w', timeout=10) as file:
            json.dump(data, file, indent=4)

    def update_order(self, symbol: str, data: Dict[str, Any]) -> None:
        trades = self.read_file_with_lock()
        order_index = next((index for (index, d) in enumerate(trades) if d["symbol"] == symbol), None)
        
        if order_index is not None:
            trades[order_index].update(data)
        else:
            trades.append(data)

        self.write_file_with_lock(trades)

    def cancel_order(self, symbol: str) -> None:
        trades = self.read_file_with_lock()
        for trade in trades:
            if trade['symbol'] == symbol:
                trade['status'] = OrderStatus.EXITED.value
                break
        self.write_file_with_lock(trades)

    def get_order(self, symbol: str) -> Optional[Dict[str, Any]]:
        trades = self.read_file_with_lock()
        return next((trade for trade in trades if trade['symbol'] == symbol), None)

    def list_orders(self, status: Optional[OrderStatus] = None) -> List[Dict[str, Any]]:
        trades = self.read_file_with_lock()
        if status:
            return [trade for trade in trades if trade['status'] == status.value]
        return trades

    def list_active_trades(self) -> List[Dict[str, Any]]:
        return self.list_orders(OrderStatus.ACTIVE)

    def list_completed_trades(self) -> List[Dict[str, Any]]:
        return self.list_orders(OrderStatus.EXITED)