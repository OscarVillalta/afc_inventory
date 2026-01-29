# QuickBooks Integration API Documentation

## Endpoint: Create Order from QuickBooks

**POST** `/api/orders/from-qb`

Creates a new order in the AFC Inventory system by pulling data from QuickBooks via the QB bridge.

### Request Body

```json
{
  "reference_number": "8800",
  "qb_doc_type": "sales_order"
}
```

#### Parameters

- `reference_number` (required, string): The QuickBooks reference number for the document
- `qb_doc_type` (required, string): The type of QuickBooks document. Must be one of:
  - `"sales_order"` or `"salesorder"` - For sales orders
  - `"estimate"` - For estimates
  - `"invoice"` - For invoices

### Response

#### Success Response (201 Created)

```json
{
  "message": "Order created successfully from QuickBooks",
  "order_id": 42,
  "order_number": "AFC-000042",
  "external_order_number": "8800",
  "customer_name": "ABC Company",
  "items_created": 3,
  "items_skipped": 0,
  "created_items": [
    {
      "type": "product",
      "name": "FILTER-001",
      "quantity": 10
    },
    {
      "type": "separator",
      "description": "--- Section Header ---"
    },
    {
      "type": "product",
      "name": "FILTER-002",
      "quantity": 5
    }
  ],
  "skipped_items": [],
  "metadata": {
    "ref_number": "8800",
    "customer_name": "ABC Company",
    "txn_date": "2024-01-15",
    "memo": "Test order"
  }
}
```

#### Error Responses

**400 Bad Request** - Invalid input
```json
{
  "error": "reference_number is required"
}
```

**409 Conflict** - Duplicate order
```json
{
  "error": "Order with this reference number already exists",
  "existing_order_id": 42,
  "existing_order_number": "AFC-000042"
}
```

**502 Bad Gateway** - QuickBooks service unavailable
```json
{
  "error": "Failed to connect to QuickBooks service",
  "details": "Connection refused"
}
```

### How It Works

1. **Validation**: Validates the reference number and document type
2. **Duplicate Check**: Checks if an order with this reference number already exists
3. **QuickBooks Query**: Queries the QB agent bridge for the document data
4. **XML Parsing**: Securely parses the QBXML response
5. **Customer Matching**: Finds or creates the customer by name
6. **Order Creation**: Creates the order with the external reference number
7. **Item Processing**: 
   - **Product Items**: Matches QB item names to products in the database (air filters or misc items)
   - **Separator Items**: Line items with only descriptions (no product name) are created as section headers
8. **Response**: Returns detailed information about what was created and any items that couldn't be matched

### Product Matching

Products are matched by comparing the QuickBooks item name with:
- Air filter part numbers (exact match, then case-insensitive)
- Misc item names (exact match, then case-insensitive)

If a product cannot be found in the database, it will be listed in the `skipped_items` array.

### Example Usage

```bash
curl -X POST http://localhost:5000/api/orders/from-qb \
  -H "Content-Type: application/json" \
  -d '{
    "reference_number": "8800",
    "qb_doc_type": "sales_order"
  }'
```

### Environment Configuration

Make sure the QuickBooks bridge URL is configured in your `.env` file:

```
QB_AGENT_URL=http://127.0.0.1:5055
```

### Security Features

- ✅ Secure XML parsing using defusedxml (prevents XXE attacks)
- ✅ Input validation on all parameters
- ✅ Duplicate order detection
- ✅ Proper error handling with database rollback
- ✅ SQL injection protection via SQLAlchemy
