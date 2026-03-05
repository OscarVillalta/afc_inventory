import pandas as pd

EXCEL_PATH = r"./ItemList_with_dimensions.xlsx"
SHEET_NAME = "data"
OUTPUT_CSV = "Classified_ItemList.csv"

FILTER_KEYWORDS = [
    "merv", "filter", "ply", "hepa", "ulpa", "pleat", "pleated",
    "panel", "prefilter", "pre-filter", "v-bank",
    "mini pleat", "bag filter", "cartridge", "cube filter", "box", "bag", "cylinder",
    "rigid", "sock", "cube", "panel", "media", "synthetic", "fiberglass", "canister", "cel", "Glass", "glass", "canister",
    
]

SALES_KEYWORDS = [
    "tax", "freight", "shipping", "delivery",
    "storage", "fee", "labor", "installation",
    "service", "repair", "discount",
    "adjustment", "credit", "shop supplies"
]

# The exact columns you want to keep in the final CSV
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
    "Classification"
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

def main():
    print(f"Loading data from {EXCEL_PATH}...")
    df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME)
    
    # Column indexes (0-based) based on your original file structure
    IDX_DESC = 4
    IDX_H = 20
    IDX_W = 21
    IDX_MERV = 24

    classifications = []

    print("Classifying items...")
    for _, row in df.iterrows():
        # Safely extract data using the same index positions
        description = str(row.iloc[IDX_DESC]).strip() if not pd.isna(row.iloc[IDX_DESC]) else ""
        height = safe_int(row.iloc[IDX_H])
        width = safe_int(row.iloc[IDX_W])
        merv = safe_int(row.iloc[IDX_MERV])

        # 1. Check if it is an Air Filter
        if height > 0 and width > 0 and (merv > 0 or "%" in description):
            classifications.append("air_filter")
        elif contains_any(description, FILTER_KEYWORDS):
            classifications.append("air_filter")
            
        # 2. Check if it is a Sales Item (Services, shipping, labor, etc.)
        elif contains_any(description, SALES_KEYWORDS):
            classifications.append("sales_item")
            
        # 3. Everything else defaults to a physical Stock Item
        else:
            classifications.append("stock_item")

    # Attach the results to the dataframe as a new column
    df['Classification'] = classifications

    # Filter the dataframe to only include the required columns
    # Using .reindex or intersection prevents errors if a column name has a slight typo in the original file
    existing_columns = [col for col in COLUMNS_TO_KEEP if col in df.columns]
    df_filtered = df[existing_columns]

    # Save the cleaned, trimmed dataframe to a new CSV file
    df_filtered.to_csv(OUTPUT_CSV, index=False)
    
    print(f"\nSuccess! Cleaned and trimmed data saved to {OUTPUT_CSV}")
    print("-" * 30)
    print("Classification Summary:")
    print(df['Classification'].value_counts())

if __name__ == "__main__":
    main()