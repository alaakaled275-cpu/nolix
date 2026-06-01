import requests
import json

url = "http://127.0.0.1:8000/decide"
headers = {"Content-Type": "application/json"}

# 1. Premium LTV with shipping friction (Should NOT get discount, maybe free_shipping or upsell)
payload_premium = {
    "session_id": "test_session_premium",
    "event": "heartbeat",
    "data": {
        "time_on_page": 120,
        "hesitation_score": 0.8,
        "cart_status": "checkout",
        "exit_intent": True
    },
    "context": {
        "returning_user": True,
        "total_sessions": 6,
        "cart_value": 250.0,
        "aov": 250.0
    }
}

# 2. Low LTV, High Friction (Should get discount)
payload_low = {
    "session_id": "test_session_low",
    "event": "heartbeat",
    "data": {
        "time_on_page": 40,
        "hesitation_score": 0.7,
        "cart_status": "checkout",
        "exit_intent": True
    },
    "context": {
        "returning_user": False,
        "total_sessions": 1,
        "cart_value": 40.0,
        "aov": 40.0
    }
}

try:
    print("Testing Premium LTV:")
    res_premium = requests.post(url, json=payload_premium)
    print(json.dumps(res_premium.json(), indent=2))

    print("\nTesting Low LTV:")
    res_low = requests.post(url, json=payload_low)
    print(json.dumps(res_low.json(), indent=2))
except Exception as e:
    print("AI Brain might not be running. Start it to verify.")
    print(e)
