import pandas as pd
import numpy as np

def classify_line_item(row):
    # Extract row data safely
    item_type = str(row.get('Type', '')).strip().lower()
    description = str(row.get('Description', '')).lower()
    item_name = str(row.get('Item', '')).lower()
    
    # Check for valid dimensions or MERV ratings
    has_dimensions = pd.notna(row.get('Height')) and pd.notna(row.get('Width'))
    has_merv = pd.notna(row.get('MERV')) and str(row.get('MERV')).strip() != ''
    
    # Check for common filter terminology in the description or item name
    filter_keywords = ['filter', 'pleat', 'poly panel', 'merv', 'v-bank', 'gold panel', 'hepa']
    is_filter_keyword = any(kw in description or kw in item_name for kw in filter_keywords)

    # 1. Classify Sales Items (Services, non-inventory, taxes)
    if item_type in ['service', 'sales tax item', 'non-inventory part']:
        return 'Sales_item'
        
    # 2. Classify Air Filters (Based on dimensions, MERV, or keywords)
    elif has_dimensions or has_merv or is_filter_keyword:
        return 'air_Filter'
        
    # 3. Classify Stock Items (Standard inventory parts like gaskets, switches, struts)
    elif item_type == 'inventory part':
        return 'Stock_Item'
        
    # 4. Fallback for unhandled data
    else:
        return 'misc_item'

def clean_quickbooks_data(file_path, output_path):
    # Load the Quickbooks CSV dataset
    df = pd.read_csv(file_path, encoding='cp1252')
    
    # Apply the heuristic classification to a new column
    df['Classification'] = df.apply(classify_line_item, axis=1)
    
    # Optional: Fill NaN values with empty strings or 0s for database consistency
    df = df.fillna('')
    
    # Display a summary of the classification results
    print("Classification Summary:")
    print(df['Classification'].value_counts())
    
    # Save the cleaned dataset
    df.to_csv(output_path, index=False)
    print(f"\nCleaned data saved to {output_path}")

if __name__ == "__main__":
    # Point this to your actual file
    INPUT_CSV = 'ItemList_with_dimensions.csv'
    OUTPUT_CSV = 'Cleaned_ItemList.csv'
    
    clean_quickbooks_data(INPUT_CSV, OUTPUT_CSV)