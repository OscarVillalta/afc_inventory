# Shared Quantity Pool Feature

## Overview

The inventory system now supports **shared quantity pools** where multiple products can share the same inventory quantity. This is useful for products that are essentially the same item but may have different identifiers or catalog entries.

## How It Works

### Main Products vs Related Products

- **Main Product**: A product with its own `Quantity` record that has no `parent_product_id`
- **Related Product**: A product that shares a quantity pool with a main product by setting `parent_product_id`

### Key Concepts

1. **Parent-Child Relationship**: Related products point to a main product via `parent_product_id`
2. **Shared Quantity Pool**: Related products don't have their own quantity record; they use the parent's
3. **Transaction Handling**: All transactions on related products affect the parent's quantity pool
4. **Automatic Resolution**: The system automatically resolves which quantity record to use

## Database Schema

### Product Table Changes

```sql
ALTER TABLE products ADD COLUMN parent_product_id INTEGER;
ALTER TABLE products ADD CONSTRAINT fk_products_parent_product_id 
  FOREIGN KEY (parent_product_id) REFERENCES products(id);
```

### Quantity Records

- Main products have a `Quantity` record
- Related products do NOT have their own `Quantity` record
- The `Product.get_effective_quantity()` method returns the appropriate quantity record

## API Usage

### Creating a Main Product

When creating an air filter or misc item without a `parent_product_id`, it becomes a main product:

```json
POST /api/air_filters
{
  "part_number": "AF-12345",
  "supplier_id": 1,
  "category_id": 1,
  "merv_rating": 8,
  "height": 20,
  "width": 20,
  "depth": 1
}
```

Response includes `quantity_id` indicating it has its own quantity pool.

### Creating a Related Product

To create a product that shares quantity with another:

```json
POST /api/air_filters
{
  "part_number": "AF-12345-ALT",
  "supplier_id": 1,
  "category_id": 1,
  "merv_rating": 8,
  "height": 20,
  "width": 20,
  "depth": 1,
  "parent_product_id": 42
}
```

Response includes `parent_product_id` instead of `quantity_id`.

### Updating Product Relationships

Use the new endpoint to change a product's parent:

```json
PATCH /api/products/{id}/parent
{
  "parent_product_id": 42
}
```

To make a related product standalone (remove parent):
```json
PATCH /api/products/{id}/parent
{
  "parent_product_id": null
}
```

### Validations

The system enforces several rules:

1. **No Self-Reference**: A product cannot be its own parent
2. **No Nested Parents**: A parent product cannot itself have a parent
3. **No Circular References**: A product cannot have one of its children as a parent
4. **Parent Must Exist**: The parent_product_id must reference an existing product

## Transaction Behavior

### Creating Transactions

Transactions work the same way for both main and related products:

```json
POST /api/transactions
{
  "product_id": 43,  // Can be a related product
  "quantity_delta": -5,
  "reason": "shipment"
}
```

The system automatically:
1. Resolves the effective quantity record (parent's if applicable)
2. Updates the correct quantity pool
3. Records the transaction against the specified product_id

### Committing Transactions

```json
PATCH /api/transactions/{id}/commit
```

The commit operation:
1. Uses `Product.get_effective_quantity()` to find the right quantity record
2. Updates the parent's quantity if this is a related product
3. Maintains the transaction history against the original product_id

### Rolling Back Transactions

```json
PATCH /api/transactions/{id}/rollback
```

Rollbacks also use the effective quantity record, ensuring consistency.

## Querying Products

### GET Single Product

```json
GET /api/products/{id}
```

Response includes both `parent_product_id` and the effective `quantity`:

```json
{
  "id": 43,
  "category": "Air Filters",
  "reference_id": 12,
  "parent_product_id": 42,
  "details": {
    "part_number": "AF-12345-ALT",
    ...
  },
  "quantity": {
    "on_hand": 100,
    "reserved": 10,
    "ordered": 20,
    "location": 1
  }
}
```

Note: The `quantity` field shows the parent's quantity for related products.

### Search Results

Search endpoints in `/api/air_filters/search` and `/api/misc_items/search` automatically include:
- `parent_product_id` field
- Effective quantity from the parent if applicable

## Migration Guide

### For Existing Data

1. Run the database migration:
   ```bash
   cd database
   alembic upgrade head
   ```

2. All existing products will have `parent_product_id = NULL` (main products)

3. To link existing products:
   ```bash
   # Use the PATCH endpoint to set parent relationships
   curl -X PATCH /api/products/43/parent \
     -H "Content-Type: application/json" \
     -d '{"parent_product_id": 42}'
   ```

### Quantity Record Handling

- **Making a product a child**: The system keeps the existing quantity record but stops using it
- **Making a child standalone**: The system creates a new quantity record if needed

## Use Cases

### Example 1: Same Product, Different Suppliers

```
Main Product: AF-12345 (Supplier A)
Related Products:
  - AF-12345-B (Supplier B) -> shares quantity with AF-12345
  - AF-12345-C (Supplier C) -> shares quantity with AF-12345
```

All three products share the same physical inventory.

### Example 2: Rebranded Products

```
Main Product: Original Brand Filter
Related Products:
  - Private Label Version 1 -> shares quantity
  - Private Label Version 2 -> shares quantity
```

### Example 3: Size Variations (Same Inventory)

```
Main Product: Standard Package
Related Products:
  - Bulk Package -> shares quantity (same item, different packaging)
  - Sample Package -> shares quantity (same item, smaller quantity)
```

## Best Practices

1. **Choose Main Products Carefully**: Make the most commonly used or "canonical" version the main product
2. **Document Relationships**: Use product notes or descriptions to indicate which products share quantity
3. **Monitor Transactions**: Review transaction history by product_id to see which SKUs are moving
4. **Regular Audits**: Periodically verify that parent-child relationships still make business sense

## Troubleshooting

### "Quantity record missing for product or its parent"

This means:
- A related product's parent was deleted
- A related product references an invalid parent_product_id

Solution: Update the product's parent_product_id or set it to NULL

### "Parent product cannot itself be a child product"

You're trying to use a related product as a parent.

Solution: Only use main products (products without parent_product_id) as parents

### Quantity shows wrong values

Check:
1. The product's `parent_product_id` field
2. The parent product's quantity record
3. Recent transactions on both the child and parent products

## Technical Details

### Code Changes

1. **database/models.py**:
   - Added `parent_product_id` field to Product
   - Added `parent_product` and `child_products` relationships
   - Added `get_effective_quantity()` method
   - Updated Transaction commit/rollback/cancel to use effective quantity

2. **API Routes**:
   - Updated air_filters.py to handle parent_product_id on create
   - Updated misc_items.py to handle parent_product_id on create
   - Updated products.py to show effective quantity and parent info
   - Added `/products/{id}/parent` endpoint for updating relationships

3. **Schemas**:
   - Added parent_product_id to ProductSchema
   - Added parent_product_id to AirFilterSchema
   - Added parent_product_id to MiscItemSchema

### Database Migration

Migration file: `085c8fa5b108_add_parent_product_id_to_products.py`

Adds:
- `parent_product_id` column (nullable)
- Foreign key constraint to products table
