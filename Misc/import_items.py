import time
import pandas as pd
import requests

EXCEL_PATH = r"./ItemList_with_dimensions.xlsx"
SHEET_NAME = "data"

AIR_FILTER_ENDPOINT = "http://192.168.1.177:5000/api/air_filters"
STOCK_ITEM_ENDPOINT = "http://192.168.1.177:5000/api/stock_items"
MISC_ITEM_ENDPOINT = "http://192.168.1.177:5000/api/misc_items"

DEFAULT_AIR_FILTER_CATEGORY_ID = 1
DEFAULT_STOCK_CATEGORY_ID = 1  # change as needed

HEADERS = {"Content-Type": "application/json"}

# === Supplier Map (same as before) ===
SUPPLIER_MAP = {
    "Caldwell Gasket": 1,
    "Hilliard Corporation": 2,
    "UVDI UltraViolet Devices, Inc.": 3,
    "M.L. Filters": 4,
    "Commercial Filters Sales": 5,
    "Fiber Bond Corporation": 6,
    "AAF/Flanders Corporation": 7,
    "RSE Incorporated": 8,
    "Aircon Filter Mfg. Co., Inc.": 9,
    "Freudenberg Filtration Technologies, L.P.": 10,
    "Parker-Hannifin Corporation": 11,
    "Wetzel Technologies Co., Ltd": 12,
    "Fluitek Corporation. (PAID BY CC)": 13,
    "Total Filtration Services": 14,
    "SHW FILTER-Guangzhou Sun": 15,
    "Munters": 16,
    "Portacool": 17,
    "HuTek (Asia) Company Ltd": 18,
    "Advanced Sealing": 19,
    "Columbus Industries, Inc.": 20,
    "CMS Century Mechanical Systems": 21,
    "Excelair International, Inc.": 22,
    "Glasfloss Industries": 23,
    "Fleetlife, Inc.": 24,
    "Zephyr Filtration": 25,
    "American Nonwoven, Inc. / VFT INC.": 26,
    "Mikropor America": 27,
    "SoCal Filters and Service": 28,
    "Hengst Filtration USA, LLC": 29,
    "MGT Air Filters": 30,
    "NXTNANO, LLC": 31,
    "Komar Alliance": 32,
    "EFC International": 33,
    "United Filters": 34,
    "Precision Filter Products, LLC": 35,
    "Industrial Filtration, Inc.": 36,
    "Aeolus Corporation": 37,
    "Universal Elastic & Garment": 38,
    "Millions must live": 40,
    "QuickBooks": 41,
}

FILTER_KEYWORDS = [
    "merv", "hepa", "ulpa", "pleat", "pleated",
    "panel", "prefilter", "pre-filter", "v-bank",
    "mini pleat", "bag filter", "cartridge", "cube filter"
]

MISC_KEYWORDS = [
    "tax", "freight", "shipping", "delivery",
    "storage", "fee", "labor", "installation",
    "service", "repair", "discount",
    "adjustment", "credit", "shop supplies"
]

def safe_int(value):
    if pd.isna(value) or str(value).strip() == "":
        return 0
    try:
        return int(round(float(value)))
    except:
        return 0

def contains_any(text, keywords):
    if not isinstance(text, str):
        return False
    t = text.lower()
    return any(k in t for k in keywords)

def classify(description, height, width, merv):
    if contains_any(description, MISC_KEYWORDS):
        return "misc_item"

    if height > 0 and width > 0 and (merv > 0 or "%" in description):
        return "air_filter"

    if contains_any(description, FILTER_KEYWORDS):
        return "air_filter"

    return "stock_item"

def main():
    df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME)
    session = requests.Session()
    session.headers.update(HEADERS)

    # Column indexes (0-based)
    IDX_PART = 3
    IDX_DESC = 4
    IDX_SUPPLIER = 13
    IDX_H = 20
    IDX_W = 21
    IDX_D = 22
    IDX_MERV = 24

    for _, row in df.iterrows():

        part_number = str(row.iloc[IDX_PART]).strip() if not pd.isna(row.iloc[IDX_PART]) else ""
        description = str(row.iloc[IDX_DESC]).strip() if not pd.isna(row.iloc[IDX_DESC]) else ""
        supplier_name = str(row.iloc[IDX_SUPPLIER]).strip() if not pd.isna(row.iloc[IDX_SUPPLIER]) else ""

        height = safe_int(row.iloc[IDX_H])
        width = safe_int(row.iloc[IDX_W])
        depth = safe_int(row.iloc[IDX_D])
        merv = safe_int(row.iloc[IDX_MERV])

        if not part_number:
            continue

        supplier_id = SUPPLIER_MAP.get(supplier_name)
        if not supplier_id:
            print(f"Skipping {part_number} — Unknown supplier: {supplier_name}")
            continue

        classification = classify(description, height, width, merv)

        if classification == "air_filter":
            payload = {
                "part_number": part_number,
                "supplier_id": supplier_id,
                "category_id": DEFAULT_AIR_FILTER_CATEGORY_ID,
                "merv_rating": merv,
                "height": height,
                "width": width,
                "depth": depth,
            }
            endpoint = AIR_FILTER_ENDPOINT

        elif classification == "stock_item":
            payload = {
                "name": part_number,
                "description": description,
                "supplier_id": supplier_id,
                "category_id": 1,
            }
            endpoint = STOCK_ITEM_ENDPOINT

        else:  # misc_item
            payload = {
                "name": part_number,
                "supplier_id": supplier_id,
                "description": description,
            }
            endpoint = MISC_ITEM_ENDPOINT

        try:
            r = session.post(endpoint, json=payload, timeout=10)
            if r.status_code not in (200, 201):
                print(f"FAILED {part_number}: {r.status_code} {r.text}")
        except Exception as e:
            print(f"ERROR posting {part_number}: {e}")

        time.sleep(0.03)

    print("Import complete.")

if __name__ == "__main__":
    main()