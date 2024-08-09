import unittest
import json
from server import app

class ServerTestCase(unittest.TestCase):

    def setUp(self):
        # Setup the test client from Flask
        self.app = app.test_client()
        self.app.testing = True

    def test_get_orders_no_status(self):
        response = self.app.get('/api/orders')
        self.assertEqual(response.status_code, 200)

    def test_get_orders_with_status(self):
        response = self.app.get('/api/orders?status=HOLDING')
        self.assertEqual(response.status_code, 200)

    def test_get_orders_invalid_status(self):
        response = self.app.get('/api/orders?status=INVALID')
        self.assertEqual(response.status_code, 400)
        self.assertIn('Invalid status', response.json['error'])

    def test_get_order_not_found(self):
        response = self.app.get('/api/orders/INVALID_SYMBOL')
        self.assertEqual(response.status_code, 404)
        self.assertIn('Order not found', response.json['error'])

    def test_create_order_success(self):
        order_data = {
            "symbol": "TSLA",
            "status": "HOLDING",
            "entryPrice": 100,
            "currentPrice": 105,
            "profit": 5,
            "maType": "some_strategy",
            "period": "1d",
            "initialSL": 90,
            "secondarySL": 95,
            "initialSLPct": 10,
            "secondarySLPct": 5
        }
        response = self.app.post('/api/orders', data=json.dumps(order_data), content_type='application/json')
        self.assertEqual(response.status_code, 201)
        self.assertIn('Order created/updated successfully', response.json['message'])

    def test_update_order_not_found(self):
        update_data = {"currentPrice": 110}
        response = self.app.put('/api/orders/INVALID_SYMBOL', data=json.dumps(update_data), content_type='application/json')
        self.assertEqual(response.status_code, 404)
        self.assertIn('Order not found', response.json['error'])

    def test_update_order_success(self):
        # Setup an order first
        order_data = {
            "symbol": "GOOGL",
            "status": "HOLDING",
            "entryPrice": 100,
            "currentPrice": 105,
            "profit": 5,
            "maType": "some_strategy",
            "period": "1d",
            "initialSL": 90,
            "secondarySL": 95,
            "initialSLPct": 10,
            "secondarySLPct": 5
        }
        self.app.post('/api/orders', data=json.dumps(order_data), content_type='application/json')

        # Now, update the order
        update_data = {"currentPrice": 110}
        response = self.app.put('/api/orders/GOOGL', data=json.dumps(update_data), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('Order updated successfully', response.json['message'])

    def test_delete_order_success(self):
        # Setup an order first
        order_data = {
            "symbol": "WEED",
            "status": "HOLDING",
            "entryPrice": 100,
            "currentPrice": 105,
            "profit": 5,
            "maType": "some_strategy",
            "period": "1d",
            "initialSL": 90,
            "secondarySL": 95,
            "initialSLPct": 10,
            "secondarySLPct": 5
        }
        self.app.post('/api/orders', data=json.dumps(order_data), content_type='application/json')

        # Now, delete the order
        response = self.app.delete('/api/orders/WEED')
        self.assertEqual(response.status_code, 200)
        self.assertIn('Order canceled successfully', response.json['message'])

    def test_get_completed_trades(self):
        response = self.app.get('/api/completed_trades')
        self.assertEqual(response.status_code, 200)

    def test_get_stock_data(self):
        response = self.app.get('/api/stock/TSLA')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(len(response.json) > 0)

    def test_get_notifications(self):
        response = self.app.get('/api/notifications')
        self.assertEqual(response.status_code, 200)

if __name__ == '__main__':
    unittest.main()
