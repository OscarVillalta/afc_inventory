import time
import pandas as pd
import requests
import concurrent.futures

INPUT_CSV = "ItemList_with_dimensions.csv"
BASE_URL = "https://afc-backend-19h0.onrender.com/api"

AIR_FILTER_ENDPOINT = f"{BASE_URL}/air_filters"
STOCK_ITEM_ENDPOINT = f"{BASE_URL}/stock_items"
BLOCKED_ITEM_ENDPOINT = f"{BASE_URL}/blocked_items"
MEDIA_ENDPOINT = f"{BASE_URL}/media"

DEFAULT_AIR_FILTER_CATEGORY_ID = 1

# How many items to process at the exact same time
MAX_WORKERS = 15 

HEADERS = {"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc3NjA5OTQ3OCwianRpIjoiNzY4Y2NlNWQtNGYyZi00NGEyLTg2ZTYtYTI4NWFkOGVhYzNlIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjMiLCJuYmYiOjE3NzYwOTk0NzgsImNzcmYiOiI0NzgwNzFmYi02Mjk3LTQ3NWYtYTlmYi0wMzVlNDgzZTI0ZDQiLCJleHAiOjE3NzY1MzE0NzgsInJvbGUiOiJBZG1pbiIsInBlcm1pc3Npb25zIjpbInVzZXJzOnZpZXciLCJ1c2VyczpjcmVhdGUiLCJ1c2VyczplZGl0IiwidXNlcnM6ZGVsZXRlIiwicm9sZXM6bWFuYWdlIiwib3JkZXJzOnZpZXciLCJvcmRlcnM6Y3JlYXRlIiwib3JkZXJzOmVkaXQiLCJvcmRlcnM6ZGVsZXRlIiwib3JkZXJzOm1hcmtfaW52b2ljZWQiLCJvcmRlcnM6bWFya19wYWlkIiwicWI6cHVsbF9vcmRlcnMiLCJxYjpzeW5jX2NhdGFsb2ciLCJpbnZlbnRvcnk6dmlldyIsImludmVudG9yeTphbGxvY2F0ZSIsImludmVudG9yeTpmdWxmaWxsIiwiaW52ZW50b3J5Om1hbnVhbF9hZGp1c3QiLCJ0cmFuc2FjdGlvbnM6cm9sbGJhY2siLCJjYXRhbG9nOnZpZXciLCJjYXRhbG9nOmNyZWF0ZSIsImNhdGFsb2c6ZWRpdCIsImNhdGFsb2c6YXJjaGl2ZSIsInRyYWNrZXI6dmlldyIsInRyYWNrZXI6dXBkYXRlX2FueSIsImNvbnZlcnNpb25zOnZpZXciLCJjb252ZXJzaW9uczpjcmVhdGUiLCJjb252ZXJzaW9uczplZGl0IiwiY29udmVyc2lvbnM6cm9sbGJhY2siLCJ0cmFja2VyOnVwZGF0ZV9zYWxlcyIsInRyYWNrZXI6dXBkYXRlX3NlcnZpY2UiLCJ0cmFja2VyOnVwZGF0ZV9sb2dpc3RpY3MiLCJ0cmFja2VyOnVwZGF0ZV9kZWxpdmVyeSIsInRyYWNrZXI6c2V0X2JhY2tvcmRlcmVkIiwiaW52ZW50b3J5OnRyYW5zZmVyIiwiaW52ZW50b3J5OmVkaXQiXX0.OXLn_Kzn9Z8AqBBih9KbrUHhdPn4bOw3EC9FOB19d5s"}

SUPPLIER_MAP = {
    "Columbus Industries, Inc.": 150, "AFC Manufacturing": 151, "Caldwell Gasket": 152,
    "Wetzel Technologies Co., Ltd": 153, "Hilliard Corporation": 154, "UVDI UltraViolet Devices, Inc.": 155,
    "M.L. Filters": 156, "Commercial Filters Sales": 157, "Fiber Bond Corporation": 158,
    "AAF/Flanders Corporation": 159, "RSE Incorporated": 160, "Aircon Filter Mfg. Co., Inc.": 161,
    "Freudenberg Filtration Technologies, L.P.": 162, "Parker-Hannifin Corporation": 163,
    "Fluitek Corporation. (PAID BY CC)": 164, "Total Filtration Services": 165,
    "SHW FILTER-Guangzhou Sun": 166, "Munters": 167, "Portacool": 168, "HuTek (Asia) Company Ltd": 169,
    "Advanced Sealing": 170, "CMS Century Mechanical Systems": 171, "Excelair International, Inc.": 172,
    "EFC International": 173, "Glasfloss Industries": 174, "Fleetlife, Inc.": 175, "Zephyr Filtration": 176,
    "American Nonwoven, Inc. / VFT INC.": 177, "Mikropor America": 178, "SoCal Filters and Service": 179,
    "Hengst Filtration USA, LLC": 180, "MGT Air Filters": 181, "NXTNANO, LLC": 182, "Komar Alliance": 183,
    "United Filters": 184, "Precision Filter Products, LLC": 185, "Industrial Filtration, Inc.": 186,
    "Aeolus Corporation": 187, "Universal Elastic & Garment": 188, "Killer Filter-PPD CREDIT CARD": 189,
    "UV Resources (Steril-Aire)": 190, "P & G Manufacturing": 191, "Filter-Mart Corporation": 192,
    "Riverfront Machine": 193, "Camfill USA INC": 194, "Cleanova": 195, "OEM Parts Network": 196,
    "Freedom Filtration": 197, "Facet - Filtration Group": 198, "Filtration Group Inc": 199,
    "Orange County Industrial Plastics": 200, "AMI Filtration Products, Inc.": 201, "Brentwood Industries": 202,
    "Bestorq Power Transmission Belts": 203, "Springfield Spring Corporation": 204, "Camfil Power Systems NA": 205,
    "Harrington Industrial Plastics": 206, "Elements Fiber, Inc.": 207, "Motion Industries": 208,
    "Blue Heaven Technologies": 209, "W.L Gore & Associates, Inc": 210, "Flodraulic Group, Inc.": 211,
    "D-Mark": 212, "AirFlotek": 213, "American Metal Filter Company": 214, "Applied Air Filters, Inc": 215,
    "Webster Associates": 216, "Hydraulic Controls Inc.": 217, "Main Filter": 218, "Blocksom & Co.": 219,
    "Smith Filter": 220, "Parker Hannifin Corporation - GT": 221, "Air Rite Service Supply, Inc": 222, "MISC": 223
}

def safe_int(value):
    if pd.isna(value) or str(value).strip() == "": return 0
    try: return int(round(float(value)))
    except: return 0

def safe_float(value):
    if pd.isna(value) or str(value).strip() == "": return None
    try: return float(value)
    except: return None

def process_single_row(row):
    """Worker function that handles a single row isolated from the main thread."""
    part_number = str(row.get("Item", "")).strip()
    description = str(row.get("Description", "")).strip()
    supplier_name = str(row.get("Preferred Vendor", "")).strip()
    classification = str(row.get("Classification", "")).strip()
    
    height = safe_int(row.get("Height"))
    width = safe_int(row.get("Width"))
    depth = safe_int(row.get("Depth"))
    category_id = safe_int(row.get("Category_ID"))
    media_length = safe_float(row.get("Length", row.get("Height")))
    media_width = safe_float(row.get("Width"))

    merv_val = row.get("MERV Value") if pd.notna(row.get("MERV Value")) else row.get("MERV")
    merv = safe_int(merv_val)

    if not part_number or part_number.lower() == 'nan':
        return ("skip", part_number, classification, None)

    supplier_id = SUPPLIER_MAP.get(supplier_name)
    if not supplier_id and classification != "sales_item":
        return ("skip", part_number, classification, f"Skipping {part_number} — Unknown supplier: {supplier_name}")

    if classification == "f":
        payload = {
            "part_number": part_number,
            "description": description if description else None,
            "supplier_id": supplier_id,
            "category_id": category_id if category_id > 0 else DEFAULT_AIR_FILTER_CATEGORY_ID,
            "merv_rating": merv if merv <= 18 else 18,
            "height": height, "width": width, "depth": depth,
        }
        endpoint = AIR_FILTER_ENDPOINT

    elif classification == "a":
        payload = {
            "name": part_number, "description": description,
            "supplier_id": supplier_id, "category_id": 1,
        }
        endpoint = STOCK_ITEM_ENDPOINT

    elif classification == "s":
        payload = {"name": part_number}
        endpoint = BLOCKED_ITEM_ENDPOINT
        
    elif classification == "m":
        payload = {
            "part_number": part_number, "description": description if description else None,
            "length": media_length, "width": media_width, "unit_of_measure": "in",
            "supplier_id": supplier_id, "category_id": 1, 
        }
        endpoint = MEDIA_ENDPOINT
        
    else:
        return ("skip", part_number, classification, f"Skipping {part_number} — Unknown class: {classification}")

    try:
        r = requests.post(endpoint, json=payload, headers=HEADERS, timeout=15)
        if r.status_code in (200, 201):
            return ("success", part_number, classification, None)
        else:
            return ("error", part_number, classification, f"{r.status_code} {r.text}")
    except Exception as e:
        return ("error", part_number, classification, str(e))


def main():
    print(f"Loading data from {INPUT_CSV}...")
    try:
        df = pd.read_csv(INPUT_CSV)
    except FileNotFoundError:
        print(f"Error: Could not find {INPUT_CSV}.")
        return

    success_count, error_count, skip_count = 0, 0, 0

    print(f"Beginning API uploads using {MAX_WORKERS} concurrent threads...\n")
    start_time = time.time()
    
    # Launch multi-threaded workers
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(process_single_row, row) for _, row in df.iterrows()]
        
        # as_completed yields results immediately as individual threads finish
        for future in concurrent.futures.as_completed(futures):
            status, part_num, classif, msg = future.result()
            
            if status == "success":
                success_count += 1
            elif status == "error":
                error_count += 1
                print(f"FAILED {part_num} ({classif}): {msg}")
            elif status == "skip":
                skip_count += 1
                if msg:
                    print(msg)
                    
            # Print a progress update every 50 items
            total_processed = success_count + error_count + skip_count
            if total_processed % 50 == 0:
                print(f"... Processed {total_processed}/{len(df)} items ...")

    elapsed_time = round(time.time() - start_time, 2)
    
    print("\n" + "="*30)
    print("Upload Complete!")
    print(f"Time Taken:          {elapsed_time} seconds")
    print(f"Successfully posted: {success_count}")
    print(f"Errors encountered:  {error_count}")
    print(f"Skipped items:       {skip_count}")
    print("="*30)

if __name__ == "__main__":
    main()