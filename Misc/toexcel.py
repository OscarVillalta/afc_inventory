import pandas as pd

EXCEL_PATH = r"./ItemList_with_dimensions.xlsx"
SHEET_NAME = "data"
OUTPUT_CSV = "Classified_ItemList.csv"

FILTER_KEYWORDS = [
    "merv", "filter", "ply", "hepa", "ulpa", "pleat", "pleated",
    "panel", "prefilter", "pre-filter", "v-bank",
    "mini pleat", "bag filter", "cartridge", "cube filter", "box", "bag", "cylinder",
    "rigid", "sock", "cube", "panel", "media", "synthetic", "fiberglass", "canister", "cel", "Glass", "glass", "canister",
    "roll", "Special", "VEE",
]

SALES_KEYWORDS = [
    "tax", "freight", "shipping", "delivery",
    "storage", "fee", "labor", "installation",
    "service", "repair", "discount",
    "adjustment", "credit", "shop supplies", "card", "fee"
]

# Ordered from most specific to least specific
AIR_FILTER_CATEGORIES = {
    "hepa": 9,
    "ulpa": 10,
    "gas phase": 8,
    "high temp": 12,
    "high efficiency": 11,
    "v-bank": 4,
    "v bank": 4,
    "vbank": 4,
    "v4-bank": 4,
    "v3-bank": 4,
    "carbon": 17,
    "cartridge": 5,
    "canister": 6,
    "cilinder": 7,
    "cylinder": 7,
    "pocket": 2,
    "bag": 1,
    "box": 3,
    "pleated": 13,
    "pleat": 13,
    "panel": 14,
    "media":15,
    "hair":15,
    "cut":15,
    "ply":14,
}

DEFAULT_AIR_FILTER_CATEGORY_ID = 16  # PANEL

# Added 'Category_ID' to the list of kept columns
COLUMNS_TO_KEEP = [
    "Item", 
    "Description", 
    "Preferred Vendor", 
    "Size_Matched_Text", 
    "Height", 
    "Width", 
    "Depth", 
    "MERV", 
    "MERV Value", 
    "Classification",
    "Category_ID"
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

def get_filter_category_id(text):
    """Scans the text for specific filter types and returns the ID."""
    text_lower = text.lower()
    for keyword, category_id in AIR_FILTER_CATEGORIES.items():
        if keyword in text_lower:
            return category_id
    return DEFAULT_AIR_FILTER_CATEGORY_ID

def main():
    print(f"Loading data from {EXCEL_PATH}...")
    df = pd.read_excel(EXCEL_PATH)
    
    # Column indexes (0-based) based on your original file structure
    IDX_PART = 3  # Item / Part Number
    IDX_DESC = 4
    IDX_H = 20
    IDX_W = 21
    IDX_MERV = 24

    classifications = []
    category_ids = []

    print("Classifying items and assigning categories...")
    for _, row in df.iterrows():
        part_number = str(row.iloc[IDX_PART]).strip() if not pd.isna(row.iloc[IDX_PART]) else ""
        description = str(row.iloc[IDX_DESC]).strip() if not pd.isna(row.iloc[IDX_DESC]) else ""
        height = safe_int(row.iloc[IDX_H])
        width = safe_int(row.iloc[IDX_W])
        merv = safe_int(row.iloc[IDX_MERV])

        search_text = f"{part_number} {description}"

        # 1. FIRST: Check if it is a Sales Item
        if contains_any(search_text, SALES_KEYWORDS):
            classifications.append("sales_item")
            category_ids.append("")  # Sales items don't need a category ID
            
        # 2. SECOND: Check if it is an Air Filter
        elif height > 0 and width > 0 and (merv > 0 or "%" in description):
            classifications.append("air_filter")
            category_ids.append(get_filter_category_id(search_text))
            
        elif contains_any(search_text, FILTER_KEYWORDS):
            classifications.append("air_filter")
            category_ids.append(get_filter_category_id(search_text))
            
        # 3. Default: Physical Stock Item
        else:
            classifications.append("stock_item")
            category_ids.append(1)  # Stock items are hardcoded to category 1

    # Attach the results to the dataframe as new columns
    df['Classification'] = classifications
    df['Category_ID'] = category_ids

    # Filter the dataframe to only include the required columns
    existing_columns = [col for col in COLUMNS_TO_KEEP if col in df.columns]
    df_filtered = df[existing_columns]

    # Save the cleaned, trimmed dataframe to a new CSV file
    df_filtered.to_csv(OUTPUT_CSV, index=False)
    
    print(f"\nSuccess! Cleaned and trimmed data saved to {OUTPUT_CSV}")
    print("-" * 30)
    print("Classification Summary:")
    print(df['Classification'].value_counts())
    print("-" * 30)
    print("Air Filter Category Breakdown:")
    # Show a quick summary of the assigned categories for filters
    filter_df = df_filtered[df_filtered['Classification'] == 'air_filter']
    print(filter_df['Category_ID'].value_counts())

if __name__ == "__main__":
    main()