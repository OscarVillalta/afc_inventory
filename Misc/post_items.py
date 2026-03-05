import time
import pandas as pd
import requests

INPUT_CSV = "Classified_ItemList.csv"
BASE_URL = "http://192.168.1.177:5000/api"

AIR_FILTER_ENDPOINT = f"{BASE_URL}/air_filters"
STOCK_ITEM_ENDPOINT = f"{BASE_URL}/stock_items"
BLOCKED_ITEM_ENDPOINT = f"{BASE_URL}/blocked_items"

DEFAULT_AIR_FILTER_CATEGORY_ID = 1

HEADERS = {"Content-Type": "application/json"}

# Reusing your supplier map


SUPPLIER_MAP = {
    "Columbus Industries": 75,
    "AFC Manufacturing": 76,
    "Caldwell Group": 77,
    "Wetzel Technologies": 78,
    "Hilliard Corporation": 79,
    "UVDI UltraViolet Devices": 80,
    "M.L. Filters": 81,
    "Commercial Filters": 82,
    "Fiber Bond": 83,
    "AAF/Flanders": 84,
    "RSE Incorporated": 85,
    "Aircon Filter": 86,
    "Freudenberg Filtration": 87,
    "Parker-Hannifin": 88,
    "Fluitek Corporation": 89,
    "Total Filtration Services": 90,
    "SHW FILTERS": 91,
    "Munters": 92,
    "Portacool": 93,
    "HuTek (Asia)": 94,
    "Advanced Filtration": 95,
    "CMS Century": 96,
    "Excelair Industries": 97,
    "EFC International": 98,
    "Glasfloss Industries": 99,
    "Fleetlife, Inc.": 100,
    "Zephyr Filtration": 101,
    "American Air Filter": 102,
    "Mikropor America": 103,
    "SoCal Filter": 104,
    "Hengst Filtration": 105,
    "MGT Air Filtration": 106,
    "NXTNANO": 107,
    "Komar Alliance": 108,
    "United Filtration": 109,
    "Precision Filtration": 110,
    "Industrial Filtration": 111,
    "Aeolus Corporation": 112,
    "Universal Air Filter": 113,
    "Killer Filter": 114,
    "UV Resources": 115,
    "P & G Manufacturing": 116,
    "Filter-Mart Corporation": 117,
    "Riverfront Filtration": 118,
    "Camfill USA": 119,
    "Cleanova": 120,
    "OEM Parts": 121,
    "Freedom Filtration": 122,
    "Facet - Filtration Group": 123,
    "Filtration Group": 124,
    "Orange County Filter": 125,
    "AMI Filtration": 126,
    "Brentwood Industries": 127,
    "Bestorq Power Transmission": 128,
    "Springfield Filtration": 129,
    "Camfil Power Systems": 130,
    "Harrington Industrial": 131,
    "Elements Filtration": 132,
    "Motion Industries": 133,
    "Blue Heaven Technologies": 134,
    "W.L Gore & Associates": 135,
    "Flodraulic Group": 136,
    "D-Mark": 137,
    "AirFlotek": 138,
    "American Filtration": 139,
    "Applied Air Systems": 140,
    "Webster Air": 141,
    "Hydraulic Supply": 142,
    "Main Filter": 143,
    "Blocksom & Co.": 144,
    "Smith Filter": 145,
    "Parker Hannifin": 146,
    "Air Rite Service": 147,
}

def safe_int(value):
    if pd.isna(value) or str(value).strip() == "":
        return 0
    try:
        return int(round(float(value)))
    except:
        return 0

def main():
    print(f"Loading data from {INPUT_CSV}...")
    try:
        df = pd.read_csv(INPUT_CSV)
    except FileNotFoundError:
        print(f"Error: Could not find {INPUT_CSV}. Make sure you run the classification script first.")
        return

    session = requests.Session()
    session.headers.update(HEADERS)

    success_count = 0
    error_count = 0
    skip_count = 0

    print("Beginning API uploads...\n")
    
    for _, row in df.iterrows():
        # Extract data from our cleaned CSV columns
        part_number = str(row.get("Item", "")).strip()
        description = str(row.get("Description", "")).strip()
        supplier_name = str(row.get("Preferred Vendor", "")).strip()
        classification = str(row.get("Classification", "")).strip()
        
        # Dimensions and MERV
        height = safe_int(row.get("Height"))
        width = safe_int(row.get("Width"))
        depth = safe_int(row.get("Depth"))
        
        # Use MERV Value if available, otherwise fallback to MERV column
        merv_val = row.get("MERV Value") if pd.notna(row.get("MERV Value")) else row.get("MERV")
        merv = safe_int(merv_val)

        # Skip if there's no part number
        if not part_number or part_number.lower() == 'nan':
            skip_count += 1
            continue

        if classification == "sales_item":
            # The blocked items schema only contains a `name` field
            payload = {
                "name": part_number,
            }
            endpoint = BLOCKED_ITEM_ENDPOINT

        # Map the supplier
        supplier_id = SUPPLIER_MAP.get(supplier_name)
        if not supplier_id:
            print(f"Skipping {part_number} — Unknown supplier: {supplier_name}")
            skip_count += 1
            continue

        # 1. Route Air Filters
        if classification == "air_filter":
            payload = {
                "part_number": part_number,
                "description": description if description else None,
                "supplier_id": supplier_id,
                "category_id": DEFAULT_AIR_FILTER_CATEGORY_ID,
                "merv_rating": merv if merv <= 18 else 18,  # Schema enforces max=18
                "height": height,
                "width": width,
                "depth": depth,
            }
            endpoint = AIR_FILTER_ENDPOINT

        # 2. Route Stock Items
        elif classification == "stock_item":
            payload = {
                "name": part_number,
                "description": description,
                "supplier_id": supplier_id,
                "category_id": 1,  # Hardcoded to 1 as requested
            }
            endpoint = STOCK_ITEM_ENDPOINT
            
        else:
            print(f"Skipping {part_number} — Unknown classification: {classification}")
            skip_count += 1
            continue
    

        # Small delay to prevent overwhelming the local API
        time.sleep(0.03)

    print("\n" + "="*30)
    print("Upload Complete!")
    print(f"Successfully posted: {success_count}")
    print(f"Errors encountered:  {error_count}")
    print(f"Skipped items:       {skip_count}")
    print("="*30)

if __name__ == "__main__":
    main()