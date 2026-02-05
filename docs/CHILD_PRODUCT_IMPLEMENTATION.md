# ChildProduct: Shared Quantity Pool Implementation

## Overview

The inventory system now supports **child products** that share quantity pools with parent products. This is implemented through a separate `child_products` table, leaving the original `products` table unchanged.

## Architecture

### Design Principles

1. **Separate Table**: ChildProduct is a completely separate table from Product
2. **Unchanged Products**: All existing Product records remain unchanged
3. **Parent Reference**: Each ChildProduct has a `parent_product_id` foreign key to a Product
4. **No Own Quantity**: ChildProducts do NOT have their own Quantity records
5. **Shared Inventory**: ChildProducts use their parent's Quantity for all operations

### Database Schema

#### ChildProduct Table

```sql
CREATE TABLE child_products (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES product_categories(id),
    reference_id INTEGER NOT NULL,
    parent_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);
```

#### Transaction Updates

```sql
ALTER TABLE transactions 
    ALTER COLUMN product_id DROP NOT NULL,
    ADD COLUMN child_product_id INTEGER REFERENCES child_products(id) ON DELETE RESTRICT;
```

#### OrderItem Updates

```sql
ALTER TABLE order_items 
    ADD COLUMN child_product_id INTEGER REFERENCES child_products(id);
```

### Models

#### ChildProduct Model

```python
class ChildProduct(Base, SerializerMixin):
    __tablename__ = "child_products"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("product_categories.id"), nullable=False)
    reference_id: Mapped[int] = mapped_column(Integer, nullable=False)
    parent_product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    parent_product: Mapped["Product"] = relationship("Product", back_populates="child_products")
    
    @property
    def quantity(self) -> Optional["Quantity"]:
        """Returns the parent product's quantity"""
        return self.parent_product.quantity if self.parent_product else None
```

#### Transaction Updates

```python
class Transaction(Base, SerializerMixin):
    product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("products.id"), nullable=True)
    child_product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("child_products.id"), nullable=True)
    
    product: Mapped[Optional["Product"]] = relationship("Product")
    child_product: Mapped[Optional["ChildProduct"]] = relationship("ChildProduct")
    
    def _get_quantity_record(self) -> Optional["Quantity"]:
        """Helper to get the appropriate quantity record"""
        if self.child_product:
            return self.child_product.quantity  # Returns parent's quantity
        elif self.product:
            return self.product.quantity
        return None
```

## API Usage

### Creating a Parent Product (unchanged)

Regular products are created the same way as before:

```bash
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

Response:
```json
{
  "message": "Air Filter created successfully",
  "product_id": 42,
  "quantity_id": 10,
  "air_filter": {...}
}
```

### Creating a Child Product

To create a child product that shares quantity with a parent:

**For Air Filters:**
```bash
POST /api/child_products/air_filter
{
  "part_number": "AF-12345-ALT",
  "supplier_id": 2,
  "category_id": 1,
  "parent_product_id": 42,
  "merv_rating": 8,
  "height": 20,
  "width": 20,
  "depth": 1
}
```

**For Misc Items:**
```bash
POST /api/child_products/misc_item
{
  "name": "Alternative Item",
  "supplier_id": 2,
  "parent_product_id": 43,
  "description": "Same as parent but different supplier"
}
```

Response:
```json
{
  "message": "Child air filter product created successfully",
  "child_product_id": 15,
  "parent_product_id": 42,
  "air_filter": {...}
}
```

### Creating Transactions

Transactions can be created for either products or child products:

**For a regular Product:**
```bash
POST /api/transactions
{
  "product_id": 42,
  "quantity_delta": -5,
  "reason": "shipment"
}
```

**For a ChildProduct:**
```bash
POST /api/transactions
{
  "child_product_id": 15,
  "quantity_delta": -5,
  "reason": "shipment"
}
```

In both cases, if the child product is used, the transaction will automatically affect the parent product's quantity pool.

### Listing Child Products

```bash
GET /api/child_products
```

Response:
```json
[
  {
    "id": 15,
    "category_id": 1,
    "reference_id": 8,
    "parent_product_id": 42,
    "is_active": true,
    "parent_product": {
      "id": 42,
      "category_id": 1,
      "reference_id": 7
    },
    "quantity": {
      "on_hand": 95,
      "reserved": 10,
      "ordered": 20
    }
  }
]
```

### Getting a Single Child Product

```bash
GET /api/child_products/15
```

The response includes the parent product information and the shared quantity.

### Deleting a Child Product

```bash
DELETE /api/child_products/15
```

This deletes:
1. The child product record
2. The associated air_filter or misc_item record
3. Does NOT affect the parent product or its quantity

## How It Works

### Transaction Flow

1. **Create Transaction**: Client provides either `product_id` OR `child_product_id`
2. **Pending State**: The transaction is created in PENDING state
3. **Get Quantity**: Transaction calls `_get_quantity_record()` which:
   - Returns `child_product.quantity` (which is parent's quantity) if child_product_id
   - Returns `product.quantity` if product_id
4. **Apply Changes**: Updates are applied to the correct quantity record
5. **Commit**: Transaction is committed, affecting the parent's inventory

### Quantity Lookup

```python
# In Transaction model
def _get_quantity_record(self) -> Optional["Quantity"]:
    if self.child_product:
        return self.child_product.quantity  # Auto-resolves to parent
    elif self.product:
        return self.product.quantity
    return None

# In ChildProduct model
@property
def quantity(self) -> Optional["Quantity"]:
    return self.parent_product.quantity if self.parent_product else None
```

## Use Cases

### Example 1: Same Product, Different Suppliers

```
Parent Product (ID: 42): AF-12345 (Supplier A)
├─ Quantity: 100 units
│
Child Products:
├─ AF-12345-B (Supplier B) -> shares 100 units
└─ AF-12345-C (Supplier C) -> shares 100 units
```

All three use the same physical inventory of 100 units.

### Example 2: Rebranded Products

```
Parent Product (ID: 50): Original Brand Filter
├─ Quantity: 75 units
│
Child Products:
├─ Private Label V1 -> shares 75 units
└─ Private Label V2 -> shares 75 units
```

### Example 3: Different Package Sizes

```
Parent Product (ID: 60): Standard Package
├─ Quantity: 200 units
│
Child Products:
├─ Bulk Package -> shares 200 units
└─ Sample Pack -> shares 200 units
```

## Migration Guide

### For New Installations

1. Run migrations:
   ```bash
   cd database
   alembic upgrade head
   ```

2. The `child_products` table will be created automatically

### For Existing Data

All existing products remain unchanged:
- Product table is unchanged
- All existing products continue to work normally
- No data migration needed

To start using child products:
1. Identify products that should share quantity
2. Choose one as the "parent" (the existing Product)
3. Create child products using the new endpoints

## API Endpoints

### ChildProduct Routes

- `GET /api/child_products` - List all child products
- `GET /api/child_products/<id>` - Get single child product
- `POST /api/child_products/air_filter` - Create child air filter
- `POST /api/child_products/misc_item` - Create child misc item
- `DELETE /api/child_products/<id>` - Delete child product

### Transaction Routes (Updated)

- `POST /api/transactions` - Now accepts `product_id` OR `child_product_id`
- All other transaction endpoints work the same way

### Product Routes (Unchanged)

- All existing product endpoints work exactly as before
- No changes to product creation, search, or management

## Advantages of This Approach

1. **No Breaking Changes**: Product table unchanged, existing code works
2. **Clear Separation**: Easy to distinguish parent vs child products
3. **Simple Logic**: ChildProduct.quantity property handles complexity
4. **Cascade Delete**: Deleting parent automatically removes children
5. **Flexible**: Can add child-specific fields without affecting products
6. **Backward Compatible**: Old integrations continue to work

## Technical Details

### Files Modified

1. **database/models.py**:
   - Added ChildProduct model
   - Updated Transaction to support child_product_id
   - Updated OrderItem to support child_product_id
   - Added Product.child_products relationship

2. **database/migrations/versions/4250ae6a0100_*.py**:
   - Creates child_products table
   - Adds child_product_id to transactions and order_items
   - Makes transactions.product_id nullable

3. **backend/app/api/Routes/child_products.py** (NEW):
   - CRUD operations for child products
   - Separate endpoints for air filters and misc items

4. **backend/app/api/Routes/transactions.py**:
   - Updated to accept product_id OR child_product_id
   - Uses _get_quantity_record() helper

5. **backend/app/api/Schemas/child_product_schema.py** (NEW):
   - Marshmallow schema for validation

### Constraints and Validations

1. **Foreign Key**: parent_product_id must reference valid Product
2. **Parent Has Quantity**: Parent product must have a quantity record
3. **Mutual Exclusion**: Transaction can have product_id OR child_product_id, not both
4. **Cascade Delete**: Deleting parent product deletes all child products
5. **Restrict Delete**: Transactions prevent deletion of child products

## Best Practices

1. **Choose Parent Wisely**: Use the most common/primary SKU as the parent
2. **Document Relationships**: Keep track of which products are children
3. **Monitor Transactions**: Review transaction history to see SKU usage patterns
4. **Consistent Categorization**: Child products should be same category as parent
5. **Clean Up**: Delete unused child products to keep database clean

## Troubleshooting

### "Parent product not found"

The parent_product_id doesn't reference a valid product.
- Verify the parent product ID exists
- Check that it hasn't been archived or deleted

### "Parent product does not have a quantity record"

Trying to create child of a product without quantity.
- Ensure parent product has been properly set up with a quantity record
- Check that parent product creation completed successfully

### "Cannot specify both product_id and child_product_id"

Transaction request includes both fields.
- Use only one: either product_id for regular products or child_product_id for child products

### Quantity shows wrong value for child product

The quantity shown is always the parent's quantity.
- This is by design - child products don't have their own quantity
- All children of the same parent will show the same quantity

## Security Summary

- ✅ No SQL injection vulnerabilities
- ✅ Foreign key constraints prevent orphaned records
- ✅ Cascade deletes prevent dangling references
- ✅ Input validation on all create endpoints
- ✅ Proper error handling for invalid IDs

## Testing

To test the implementation:

1. Create a parent product:
   ```bash
   POST /api/air_filters
   {"part_number": "TEST-001", "supplier_id": 1, "category_id": 1}
   ```

2. Note the returned product_id (e.g., 100)

3. Create a child product:
   ```bash
   POST /api/child_products/air_filter
   {"part_number": "TEST-002", "supplier_id": 2, "category_id": 1, "parent_product_id": 100}
   ```

4. Create transactions for both:
   ```bash
   POST /api/transactions
   {"product_id": 100, "quantity_delta": 50, "reason": "receive"}
   
   POST /api/transactions
   {"child_product_id": <child_id>, "quantity_delta": -10, "reason": "shipment"}
   ```

5. Verify both transactions affect the same quantity pool
