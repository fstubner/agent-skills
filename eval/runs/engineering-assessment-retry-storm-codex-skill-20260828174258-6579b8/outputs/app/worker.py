import time
import requests

PROCESSOR = "https://cards.example.com/v1/charge"


def charge(order):
    """Charge an order. Retries until the processor accepts it."""
    while True:
        try:
            response = requests.post(PROCESSOR, json={
                "order_id": order["id"],
                "amount_cents": order["amount_cents"],
                "card_token": order["card_token"],
            })
            if response.status_code == 200:
                return response.json()
        except Exception:
            pass
        time.sleep(0.05)


def run(orders):
    results = []
    for order in orders:
        results.append(charge(order))
    return results
