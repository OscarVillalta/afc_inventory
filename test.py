import pandas as pd
import requests
import json

# === CONFIG ===
CSV_PATH = "./clean.csv"
API_URL = "http://127.0.0.1:5000/api/air_filters"

# === LOAD CSV ===
df = pd.read_csv(CSV_PATH)

# === SEND EACH ROW AS POST ===
for index, row in df.iterrows():
    payload = {
        "part_number": str(row.get("Item", "")),
        "supplier_id": int(row.get("Preferred Vendor #", 0)) if not pd.isna(row.get("Preferred Vendor #")) else None,
        "height": int(row.get("height", 0)) if not pd.isna(row.get("height")) else None,
        "width": int(row.get("width", 0)) if not pd.isna(row.get("width")) else None,
        "depth": int(row.get("depth", 1)) if not pd.isna(row.get("depth")) else None,
        "category_id": int(row.get("Category #", 0)) if not pd.isna(row.get("Category #")) else None,
        "merv_rating": int(row.get("merv_rating", 0))
    }

    try:
        response = requests.post(API_URL, json=payload)
        if response.status_code == 200 or response.status_code == 201:
            print(f"[✓] Row {index+1} posted successfully.")
        else:
            print(f"[✗] Row {index+1} failed ({response.status_code}): {response.text}")
    except Exception as e:
        print(f"[!] Error posting row {index+1}: {e}")
