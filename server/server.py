
from datetime import datetime, timedelta
from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
from order_manager import OrderManager
from order_status import OrderStatus
from order_monitor import OrderMonitor

app = Flask(__name__)

# Configure CORS
CORS(app, resources={r"/api/*": {"origins": "*"}})


AUTO_REMOVE_ON_EXIT = True # TODO: fix glitch
print("AUTO_REMOVE_ON_EXIT = ", AUTO_REMOVE_ON_EXIT)
# Initialize OrderManager and OrderMonitor
order_manager = OrderManager(strategy_name='MyStrategy')
order_monitor = OrderMonitor(order_manager, price_update_interval=10, auto_remove_on_exit=AUTO_REMOVE_ON_EXIT) 
order_monitor.start()


@app.route('/api/config/auto-remove', methods=['POST'])
def set_auto_remove_on_exit():
    global AUTO_REMOVE_ON_EXIT
    data = request.json
    if 'autoRemoveOnExit' not in data:
        return jsonify({"error": "'autoRemoveOnExit' is required"}), 400
    
    AUTO_REMOVE_ON_EXIT = data['autoRemoveOnExit']
    order_monitor.auto_remove_on_exit = AUTO_REMOVE_ON_EXIT
    
    return jsonify({"message": f"AUTO_REMOVE_ON_EXIT set to {AUTO_REMOVE_ON_EXIT}"}), 200



def get_current_price(symbol):
    """Helper function to fetch the most recent price from Yahoo Finance."""
    stock = yf.Ticker(symbol)
    end_time = datetime.now()
    start_time = end_time - timedelta(days=1)  # Get data for the last 24 hours
    hist = stock.history(start=start_time, end=end_time, interval="1m")
    if not hist.empty:
        return hist['Close'].iloc[-1]
    else:
        raise ValueError(f"Unable to fetch recent price data for {symbol}")

def update_order_data(symbol, data, is_new_order=False):
    """
    Shared function to handle order updates for both new and existing orders.
    """
    existing_order = order_manager.get_order(symbol)

    # Fetch current price
    data['currentPrice'] = get_current_price(symbol)

    # Handle entry price logic
    if existing_order and 'entryPrice' not in data:
        # For updates, preserve existing entryPrice if not provided
        data['entryPrice'] = existing_order.get('entryPrice')
    elif is_new_order and ('entryPrice' not in data or data['entryPrice'] is None):
        # For new orders, set entryPrice to current price if not provided
        data['entryPrice'] = data['currentPrice']

    # Ensure entryPrice is not None or 0
    if not data.get('entryPrice'):
        raise ValueError("Entry price cannot be null or zero")

    # Set other fields
    if is_new_order:
        data['status'] = 'HOLDING'
        data['entryDatetime'] = datetime.now().isoformat()
        data['exitDatetime'] = None
        
        data["currentPrice"] = 0
        data["highestMA"] = 0
        data['profit'] = 0
        data["exitReason"] = ""


    # Update the order
    order_manager.update_order(symbol, data)

@app.route('/api/orders', methods=['POST', 'GET', 'OPTIONS'])
def handle_orders():
    if request.method == 'OPTIONS':
        return '', 204
    
    elif request.method == 'POST':
        data = request.json
        required_fields = ['symbol', 'orderType', 'maType', 'period', 'initialSL', 'initialSLPct', 'takeProfitPct', 'secondarySLPct']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"'{field}' is required"}), 400
        
        symbol = data.get('symbol')
        try:
            update_order_data(symbol, data, is_new_order=True)
            return jsonify({"message": "Order created successfully"}), 201
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    elif request.method == 'GET':
        all_orders = order_manager.list_orders()
        return jsonify(all_orders)

@app.route('/api/orders/<symbol>', methods=['GET', 'PUT', 'DELETE'])
def handle_order(symbol):
    if request.method == 'OPTIONS':
        return '', 204
    elif request.method == 'GET':
        order = order_manager.get_order(symbol)
        if order:
            return jsonify(order)
        else:
            return jsonify({"error": "Order not found"}), 404
    elif request.method == 'PUT':
        data = request.json
        if not order_manager.get_order(symbol):
            return jsonify({"error": "Order not found"}), 404
        try:
            update_order_data(symbol, data, is_new_order=False)
            return jsonify({"message": "Order updated successfully"}), 200
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
    elif request.method == 'DELETE':
        order_manager.delete_order(symbol)
        return jsonify({"message": "Order deleted successfully"}), 200
    
    else:
        return jsonify({"error": "Wrong method!"}), 500


@app.route('/api/orders/completed', methods=['DELETE'])
def delete_all_completed_orders():
    try:
        order_manager.delete_all_completed_orders()
        return jsonify({"message": "All completed orders deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/orders/<symbol>/exit', methods=['POST'])
def exit_order(symbol):
    order = order_manager.get_order(symbol)
    if not order:
        return jsonify({"error": "Order not found"}), 404

    order_manager.exit_order(symbol)
    
    return jsonify({"message": "Order exited successfully"}), 200

@app.route('/api/stock/<symbol>', methods=['GET'])
def get_stock_data(symbol):
    stock = yf.Ticker(symbol)
    end_time = datetime.now()
    start_time = end_time - timedelta(days=1)  # Get data for the last 24 hours
    hist = stock.history(start=start_time, end=end_time, interval="1m")
    data = hist.reset_index().to_dict(orient='records')
    return jsonify(data)


@app.route('/api/notifications', methods=['GET'])
def get_exit_alerts():
    exit_alerts = order_monitor.check_orders()
    return jsonify(exit_alerts)


if __name__ == '__main__':
    app.run(debug=True)