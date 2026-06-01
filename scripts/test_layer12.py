import requests
import json

url = "http://127.0.0.1:8000/decide"

# Scenario: High LTV + Low price sensitivity -> Should return "NO DISCOUNT"
payload_ltv = {
    "session_id": "test_ltv_premium",
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
        "cart_value": 300.0,
        "aov": 250.0
    }
}

# Scenario: High competition risk -> Should return early intervention (Offer discount / Show social proof)
payload_comp = {
    "session_id": "test_comp_risk",
    "event": "heartbeat",
    "data": {
        "time_on_page": 80,
        "hesitation_score": 0.8,
        "cart_status": "unknown",
        "exit_intent": False
    },
    "context": {
        "returning_user": False,
        "total_sessions": 1,
        "cart_value": 0.0,
        "aov": 50.0
    }
}

try:
    print("Testing Premium LTV Scenario:")
    res_ltv = requests.post(url, json=payload_ltv)
    print(json.dumps(res_ltv.json(), indent=2))

    print("\nTesting Competition Risk Scenario:")
    res_comp = requests.post(url, json=payload_comp)
    print(json.dumps(res_comp.json(), indent=2))
except Exception as e:
    print("AI Brain might not be running. Start it to verify.")
    print(e)
