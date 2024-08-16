
import threading
import time
import yfinance as yf
import pandas as pd
import pandas_ta as ta
from datetime import datetime, timedelta
from order_manager import OrderManager, OrderStatus
import logging

def get_curr_ohlcv(symbol, days=1, interval='1m'):
    # get curr data
    stock = yf.Ticker(symbol)
    end_time = datetime.now()
    start_time = end_time - timedelta(days=days)  #  data for the last 24 hours
    hist = stock.history(start=start_time, end=end_time, interval=interval)
    if not hist.empty:
        return hist
    else:
        logging.error(f'Stock Data OHLCV empty for {stock}!')
    
def get_curr_close(ohlcv):
    return ohlcv['Close'].iloc[-1]

def get_curr_ma(ohlcv, ma_type, period):
    """Calculate the moving average (MA) for the given symbol using pandas_ta."""

    if ohlcv.empty:
        raise ValueError(f"OHLCV EMPTY!")
    
    if ma_type == 'HMA':
        ohlcv['MA'] = ta.hma(ohlcv['Close'], length=period)
    elif ma_type == 'EMA':
        ohlcv['MA'] = ta.ema(ohlcv['Close'], length=period)
    elif ma_type == 'SMA':
        ohlcv['MA'] = ta.sma(ohlcv['Close'], length=period)
    else:
        raise ValueError(f"Unsupported ma_type: {ma_type}")

    return ohlcv['MA'].iloc[-1]

class OrderMonitor:
    def __init__(self, order_manager: OrderManager, price_update_interval, auto_remove_on_exit=False):
        self.order_manager = order_manager
        self.price_update_interval = price_update_interval
        self.auto_remove_on_exit = auto_remove_on_exit
        self.price_update_thread = threading.Thread(target=self.update_prices_continuously, daemon=True)
        self.running = False
        logging.basicConfig(level=logging.INFO)

    def start(self):
        """Start the monitoring threads."""
        self.running = True
        self.price_update_thread.start()
        logging.info("OrderMonitor started.")

    def stop(self):
        """Stop the monitoring threads."""
        self.running = False
        self.price_update_thread.join()
        logging.info("OrderMonitor stopped.")


    def update_prices_continuously(self):
        """Continuously update prices for active orders."""
        while self.running:
            self.update_all_active_orders()
            time.sleep(self.price_update_interval)

    def update_all_active_orders(self):
        """Update prices and profit for all active orders."""
        orders = self.order_manager.list_orders(OrderStatus.HOLDING)
        for order in orders:
            self.update_order_price_and_profit(order['symbol'], order)
            
            # check exit conditions
            self.evaluate_order(order['symbol'], order)

    def update_order_price_and_profit(self, symbol: str, order: dict):
        try:
            ohlcv = get_curr_ohlcv(symbol)
            current_price = get_curr_close(ohlcv)
            if current_price is None:
                logging.error(f"CURRENT PRICE IS NONE! updating price for {symbol}")
                return 

            order['currentPrice'] = current_price
            if order['entryPrice'] != 0:
                order['profit'] = ((current_price - order['entryPrice']) / order['entryPrice']) * 100
            else:
                order['profit'] = 0

            current_ma = get_curr_ma(ohlcv, ma_type=order['maType'], period=order['period'])
            if 'highestMA' not in order or current_ma > order['highestMA']:
                order['highestMA'] = current_ma

            self.order_manager.update_order(symbol, order)
        except Exception as e:
            logging.error(f"Error updating price for {symbol}: {str(e)}")


    def check_orders(self):
        """Check the status of all active orders and return exit alerts."""
        exit_alerts = []
        orders = self.order_manager.list_orders(OrderStatus.HOLDING)
        #print(f"debugging check_orders 92: orders: {orders}")
        for order in orders:
            exit_alert = self.evaluate_order(order['symbol'], order)
            if exit_alert:
                exit_alerts.append(exit_alert)
        return exit_alerts

    def evaluate_order(self, symbol: str, order: dict):
        try:
            ohlcv = get_curr_ohlcv(symbol)
            current_price = get_curr_close(ohlcv)
            if current_price is None:
                logging.error(f"CURRENT PRICE IS NONE! evaluating order for {symbol}")
                return None

            current_ma = get_curr_ma(ohlcv, ma_type=order['maType'], period=order['period'])
            if current_ma is None:
                logging.error(f"CURRENT MA IS NONE! evaluating order for {symbol}")
                return None

            order['currentPrice'] = current_price
            if order['entryPrice'] != 0:
                order['profit'] = ((current_price - order['entryPrice']) / order['entryPrice']) * 100
            else:
                order['profit'] = 0

            if 'highestMA' not in order or not order['highestMA'] or current_ma > order['highestMA']:
                order['highestMA'] = current_ma

            takeProfitReached = False
            take_profit_price = order['entryPrice'] * (1 + order['takeProfitPct'] / 100)
            if order['highestMA'] >= take_profit_price:
                takeProfitReached = True

            exit_reason = None
            if takeProfitReached:
                if order['secondarySLPct'] <= 0:
                    exit_reason = "Auto-Sell (Take Profit) hit"
                secondary_sl_value = order['highestMA'] * (1 - order['secondarySLPct'] / 100)
                if current_ma <= secondary_sl_value:
                    exit_reason = "Secondary Stop Loss hit"
            else:
                if order['initialSL'] == "trailing":
                    initial_sl_value = order['highestMA'] * (1 - order['initialSLPct'] / 100)
                    if current_ma <= initial_sl_value:
                        exit_reason = "Initial Trailing Stop Loss hit"
                else:
                    initial_sl_value = order['entryPrice'] * (1 - order['initialSLPct'] / 100)
                    if current_ma <= initial_sl_value:
                        exit_reason = "Initial Static Stop Loss hit"

            if exit_reason:
                order['exitReason'] = exit_reason
                self.order_manager.update_order(symbol, order)

                if self.auto_remove_on_exit:
                    self.order_manager.exit_order(symbol)

                exit_alert = {
                    'symbol': symbol,
                    'message': f"{exit_reason} for {symbol}. Current price: {order['currentPrice']:.2f}, Profit: {order['profit']:.2f}%, Highest MA: {order['highestMA']:.2f}",
                    'timestamp': datetime.now().isoformat()
                }

                return exit_alert

        except Exception as e:
            logging.error(f"Error evaluating order for {symbol}: {str(e)}")
            return None
