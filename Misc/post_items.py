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

SUPPLIER_MAP = {
    "Columbus Industries, Inc.": 150,
    "AFC Manufacturing": 151,
    "Caldwell Gasket": 152,
    "Wetzel Technologies Co., Ltd": 153,
    "Hilliard Corporation": 154,
    "UVDI UltraViolet Devices, Inc.": 155,
    "M.L. Filters": 156,
    "Commercial Filters Sales": 157,
    "Fiber Bond Corporation": 158,
    "AAF/Flanders Corporation": 159,
    "RSE Incorporated": 160,
    "Aircon Filter Mfg. Co., Inc.": 161,
    "Freudenberg Filtration Technologies, L.P.": 162,
    "Parker-Hannifin Corporation": 163,
    "Fluitek Corporation. (PAID BY CC)": 164,
    "Total Filtration Services": 165,
    "SHW FILTER-Guangzhou Sun": 166,
    "Munters": 167,
    "Portacool": 168,
    "HuTek (Asia) Company Ltd": 169,
    "Advanced Sealing": 170,
    "CMS Century Mechanical Systems": 171,
    "Excelair International, Inc.": 172,
    "EFC International": 173,
    "Glasfloss Industries": 174,
    "Fleetlife, Inc.": 175,
    "Zephyr Filtration": 176,
    "American Nonwoven, Inc. / VFT INC.": 177,
    "Mikropor America": 178,
    "SoCal Filters and Service": 179,
    "Hengst Filtration USA, LLC": 180,
    "MGT Air Filters": 181,
    "NXTNANO, LLC": 182,
    "Komar Alliance": 183,
    "United Filters": 184,
    "Precision Filter Products, LLC": 185,
    "Industrial Filtration, Inc.": 186,
    "Aeolus Corporation": 187,
    "Universal Elastic & Garment": 188,
    "Killer Filter-PPD CREDIT CARD": 189,
    "UV Resources (Steril-Aire)": 190,
    "P & G Manufacturing": 191,
    "Filter-Mart Corporation": 192,
    "Riverfront Machine": 193,
    "Camfill USA INC": 194,
    "Cleanova": 195,
    "OEM Parts Network": 196,
    "Freedom Filtration": 197,
    "Facet - Filtration Group": 198,
    "Filtration Group Inc": 199,
    "Orange County Industrial Plastics": 200,
    "AMI Filtration Products, Inc.": 201,
    "Brentwood Industries": 202,
    "Bestorq Power Transmission Belts": 203,
    "Springfield Filtration": 204,
    "Camfil Power Systems NA": 205,
    "Harrington Industrial Plastics": 206,
    "Elements Fiber, Inc.": 207,
    "Motion Industries": 208,
    "Blue Heaven Technologies": 209,
    "W.L Gore & Associates, Inc": 210,
    "Flodraulic Group, Inc.": 211,
    "D-Mark": 212,
    "AirFlotek": 213,
    "American Metal Filter Company": 214,
    "Applied Air Filters, Inc": 215,
    "Webster Air": 216,
    "Hydraulic Controls Inc.": 217,
    "Main Filter": 218,
    "Blocksom & Co.": 219,
    "Smith Filter": 220,
    "Parker Hannifin Corporation - GT": 221,
    "Air Rite Service Supply, Inc": 222,
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
        
        # Dimensions, MERV, and Category ID
        height = safe_int(row.get("Height"))
        width = safe_int(row.get("Width"))
        depth = safe_int(row.get("Depth"))
        category_id = safe_int(row.get("Category_ID"))
        
        # Use MERV Value if available, otherwise fallback to MERV column
        merv_val = row.get("MERV Value") if pd.notna(row.get("MERV Value")) else row.get("MERV")
        merv = safe_int(merv_val)

        # Skip if there's no part number
        if not part_number or part_number.lower() == 'nan':
            skip_count += 1
            continue

        # Map the supplier
        supplier_id = SUPPLIER_MAP.get(supplier_name)
        if not supplier_id and classification != "sales_item":
            print(f"Skipping {part_number} — Unknown supplier: {supplier_name}")
            skip_count += 1
            continue

        # 1. Route Air Filters
        if classification == "air_filter":
            payload = {
                "part_number": part_number,
                "description": description if description else None,
                "supplier_id": supplier_id,
                # Dynamically apply the Category ID (or fallback to default if missing)
                "category_id": category_id if category_id > 0 else DEFAULT_AIR_FILTER_CATEGORY_ID,
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

        # 3. Route Sales Items to Blocked Items
        elif classification == "sales_item":
            # The blocked items schema only contains a `name` field
            payload = {
                "name": part_number,
            }
            endpoint = BLOCKED_ITEM_ENDPOINT
            
        else:
            print(f"Skipping {part_number} — Unknown classification: {classification}")
            skip_count += 1
            continue

        try:
            r = session.post(endpoint, json=payload, timeout=10)
            if r.status_code in (200, 201):
                success_count += 1
            else:
                error_count += 1
                print(f"FAILED {part_number} ({classification}): {r.status_code} {r.text}")
        except Exception as e:
            error_count += 1
            print(f"ERROR posting {part_number}: {e}")
    
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