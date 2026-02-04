from flask import Blueprint, g, jsonify, request
from sqlalchemy import select, func
from sqlalchemy import and_, or_
from app.api.Schemas.order_schema import OrderSchema
from database.models import Customer, Supplier, OrderType, OrderStatus, Transaction, TransactionState
from database.models import Order, OrderItem, Product, AirFilter, MiscItem, Quantity
from marshmallow import ValidationError
from datetime import datetime, timedelta
import os
import requests
from app.api.qb_xml_parser import parse_qb_line_items, extract_qb_metadata

order_bp = Blueprint("orders", __name__)
order_schema = OrderSchema()
order_list_schema = OrderSchema(many=True)

# Product category ID for Misc Items (must match product_categories table)
MISC_ITEM_CATEGORY_ID = 2

# GET all orders (paginated, filterable)
@order_bp.route("/orders", methods=["GET"])
def get_orders():
    db = g.db
    page = request.args.get("page", default=1, type=int)
    limit = request.args.get("limit", default=25, type=int)
    offset = (page - 1) * limit

    # --- Optional filters
    type_filter = request.args.get("type")          # "incoming" | "outgoing"
    status_filter = request.args.get("status")      # "Pending", "Completed"
    search = request.args.get("search", "")         # keyword in order_number or description

    query = select(Order)
    if type_filter:
        query = query.where(Order.type == type_filter)
    if status_filter:
        query = query.where(Order.status == status_filter)
    if search:
        query = query.where(Order.order_number.ilike(f"%{search}%"))

    query = query.order_by(Order.created_at.desc()).offset(offset).limit(limit)
    results = db.execute(query).scalars().all()

    total = db.execute(
        select(func.count()).select_from(Order)
    ).scalar()

    return jsonify({
        "page": page,
        "limit": limit,
        "total": total,
        "results": order_list_schema.dump(results)
    }), 200


# GET single order with items
@order_bp.route("/orders/<int:order_id>", methods=["GET"])
def get_order(order_id):
    db = g.db
    order = db.get(Order, order_id)

    if not order:
        return jsonify({"error": "Order not found"}), 404

    # Determine customer or supplier name
    cs_name = None
    cs_id = None
    if order.type == OrderType.OUTGOING.value and order.customer:
        cs_id = order.customer.id
        cs_name = order.customer.name

    elif order.type == OrderType.INCOMING.value and order.supplier:
        cs_id = order.supplier.id
        cs_name = order.supplier.name

    return jsonify({
        "id": order.id,
        "order_number": order.order_number,
        "external_order_number": order.external_order_number,
        "type": order.type,
        "cs_id": cs_id,
        "cs_name": cs_name,
        "status": order.status,
        "description": order.description,
        "created_at": order.created_at.strftime("%Y-%m-%d"),
        "completed_at": (
            order.completed_at.strftime("%Y-%m-%d")
            if order.completed_at else None
        ),
        "eta": (
            order.eta.strftime("%Y-%m-%d")
            if order.eta else None
        ),
    }), 200


# GET order items
@order_bp.route("/orders/<int:order_id>/items", methods=["GET"])
def get_order_items(order_id):
    db = g.db
    order = db.get(Order, order_id)

    if not order:
        return jsonify({"error": "Order not found"}), 404

    # Sort items by position
    sorted_items = sorted(order.items, key=lambda x: x.position)
    
    items = []
    for item in sorted_items:
        if item.is_separator:
            # Separator items don't have a product
            part_number = ""
        else:
            product = item.product

            if product and product.category.name == "Air Filters":
                part_number = product.air_filter.part_number
            elif product and product.category.name == "Miscelaneous Items":
                part_number = product.misc_item.name
            elif product:
                part_number = f"Product #{product.id}"
            else:
                part_number = "Unknown product"
        
        items.append({
            "id": item.id,
            "order_id": item.order_id,
            "product_id": item.product_id,
            "is_separator": item.is_separator,
            "part_number": part_number,
            "quantity_ordered": item.quantity_ordered,
            "quantity_fulfilled": item.quantity_fulfilled,
            "status": item.status,
            "note": item.note,
            "position": item.position,
        })

    return jsonify(items), 200


# Create new order
@order_bp.route("/orders", methods=["POST"])
def create_order():
    db = g.db

    try:
        data = order_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    order = Order.from_dict(data)

    # ===============================
    # Generate AFC order number
    # ===============================
    db.add(order)
    db.flush()  # ensures order.id is available

    order.order_number = f"AFC-{order.id:06d}"

    # ===============================
    # Validate customer / supplier
    # ===============================
    if order.type == OrderType.OUTGOING.value:
        if not order.customer_id:
            return jsonify({
                "error": "customer_id is required for outgoing orders"
            }), 400
        order.supplier_id = None

    elif order.type == OrderType.INCOMING.value:
        if not order.supplier_id:
            return jsonify({
                "error": "supplier_id is required for incoming orders"
            }), 400
        order.customer_id = None

    db.commit()

    return jsonify(order_schema.dump(order)), 201



# PATCH: Force update status (recalculate)
@order_bp.route("/orders/<int:order_id>/status", methods=["PATCH"])
def update_order_status(order_id):
    db = g.db
    order = db.get(Order, order_id)
    if not order:
        return jsonify({"error": "Order not found"}), 404

    order.update_status()
    db.commit()

    return jsonify({
        "message": "Order status updated.",
        "status": order.status
    }), 200

@order_bp.route("/orders/<int:order_id>", methods=["PATCH"])
def patch_order(order_id):
    db = g.db
    order = db.get(Order, order_id)

    if not order:
        return jsonify({"error": "Order not found"}), 404

    data = request.get_json() or {}

    # ===============================
    # ❌ Disallowed fields
    # ===============================
    for forbidden in ("status", "completed_at", "order_number"):
        if forbidden in data:
            return jsonify({
                "error": f"'{forbidden}' cannot be modified"
            }), 400
        
    # ===============================
    # Type validation
    # ===============================

    if "type" in data:
        new_type = data["type"]

        if new_type not in (
            OrderType.OUTGOING.value,
            OrderType.INCOMING.value,
        ):
            return jsonify({"error": "Invalid order type"}), 400

        order.type = new_type

    # ===============================
    # Customer / Supplier assignment
    # ===============================
    if "cs_id" in data:
        cs_id = data["cs_id"]

        if not cs_id:
            return jsonify({"error": "cs_id cannot be empty"}), 400

        if order.type == OrderType.OUTGOING.value:
            order.customer_id = cs_id
            order.supplier_id = None
        elif order.type == OrderType.INCOMING.value:
            order.supplier_id = cs_id
            order.customer_id = None

    # ===============================
    # Description
    # ===============================
    if "description" in data:
        order.description = data["description"]

    # ===============================
    # Created At (date only)
    # ===============================
    if "created_at" in data:
        try:
            order.created_at = datetime.strptime(
                data["created_at"], "%Y-%m-%d"
            )
        except ValueError:
            return jsonify({
                "error": "created_at must be YYYY-MM-DD"
            }), 400

    # ===============================
    # ETA (optional, must be >= created_at)
    # ===============================
    if "eta" in data:
        if data["eta"] is None:
            order.eta = None
        else:
            try:
                eta = datetime.strptime(
                    data["eta"], "%Y-%m-%d"
                ).date()
                created = order.created_at.date()

                if eta < created:
                    return jsonify({
                        "error": "ETA cannot be earlier than created date"
                    }), 400

                order.eta = eta
            except ValueError:
                return jsonify({
                    "error": "eta must be YYYY-MM-DD"
                }), 400
            
    if "supplier_id" in data:
        order.supplier_id = data["supplier_id"]
    
    if "external_order_number" in data:
        order.external_order_number = data["external_order_number"]

    db.commit()

    # ===============================
    # Return updated order (same shape as GET)
    # ===============================
    cs_name = None
    if order.type == OrderType.OUTGOING.value and order.customer:
        cs_name = order.customer.name
    elif order.type == OrderType.INCOMING.value and order.supplier:
        cs_name = order.supplier.name

    return jsonify({
        "id": order.id,
        "order_number": order.order_number,
        "type": order.type,
        "cs_name": cs_name,
        "status": order.status,
        "description": order.description,
        "created_at": order.created_at.strftime("%Y-%m-%d"),
        "completed_at": (
            order.completed_at.strftime("%Y-%m-%d")
            if order.completed_at else None
        ),
        "eta": (
            order.eta.strftime("%Y-%m-%d")
            if order.eta else None
        ),
    }), 200

def parse_date(date_str: str):
    return datetime.strptime(date_str, "%Y-%m-%d")

# ===============================
# SEARCH
# ===============================

@order_bp.route("/orders/search", methods=["GET"])
def search_orders():
    db = g.db

    search = request.args.get("search")
    order_type = request.args.get("type")
    status = request.args.get("status")
    
    # Date filters for created_at
    created_from = request.args.get("created_from")
    created_to = request.args.get("created_to")
    
    # Date filters for completed_at
    completed_from = request.args.get("completed_from")
    completed_to = request.args.get("completed_to")
    
    # Product filtering - comma separated product IDs
    product_ids = request.args.get("product_ids")

    page = request.args.get("page", default=1, type=int)
    limit = request.args.get("limit", default=25, type=int)
    offset = (page - 1) * limit

    query = (
        select(
            Order.id,
            Order.order_number,
            Order.external_order_number,
            Order.type,
            Order.status,
            Order.description,
            Order.created_at,
            Order.completed_at,
            Customer.name.label("customer_name"),
            Supplier.name.label("supplier_name"),
        )
        .outerjoin(Customer, Order.customer_id == Customer.id)
        .outerjoin(Supplier, Order.supplier_id == Supplier.id)
    )

    filters = []

    if order_type:
        filters.append(Order.type == order_type)

    if status:
        filters.append(Order.status == status)

    if search:
        filters.append(
            or_(
                Order.order_number.ilike(f"%{search}%"),
                Order.external_order_number.ilike(f"%{search}%"),
                Customer.name.ilike(f"%{search}%"),
                Supplier.name.ilike(f"%{search}%"),
            )
        )
    
    # Date filters for created_at
    if created_from:
        try:
            from_date = parse_date(created_from)
            filters.append(Order.created_at >= from_date)
        except ValueError:
            pass
    
    if created_to:
        try:
            to_date = parse_date(created_to)
            # Add one day to include the entire end date
            to_date = to_date + timedelta(days=1)
            filters.append(Order.created_at < to_date)
        except ValueError:
            pass
    
    # Date filters for completed_at
    if completed_from:
        try:
            from_date = parse_date(completed_from)
            filters.append(Order.completed_at >= from_date)
        except ValueError:
            pass
    
    if completed_to:
        try:
            to_date = parse_date(completed_to)
            # Add one day to include the entire end date
            to_date = to_date + timedelta(days=1)
            filters.append(Order.completed_at < to_date)
        except ValueError:
            pass
    
    # Product filtering - filter orders containing specific products
    if product_ids:
        try:
            # Parse comma-separated product IDs
            product_id_list = [int(pid.strip()) for pid in product_ids.split(",") if pid.strip()]
            if product_id_list:
                # Use a subquery to find orders that contain any of the specified products
                # This approach is cleaner and avoids potential JOIN conflicts
                product_filter_subquery = (
                    select(OrderItem.order_id)
                    .where(OrderItem.product_id.in_(product_id_list))
                    .distinct()
                )
                filters.append(Order.id.in_(product_filter_subquery))
        except (ValueError, AttributeError):
            pass

    if filters:
        query = query.where(and_(*filters))

    # ---------------- Count ----------------
    total = db.execute(
        select(func.count()).select_from(query.subquery())
    ).scalar()

    # ---------------- Page ----------------
    rows = db.execute(
        query.order_by(Order.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).mappings().all()

    output = []
    for row in rows:
        row = dict(row)
        row["cs_name"] = (
            row.pop("customer_name")
            or row.pop("supplier_name")
        )
        output.append(row)

    return jsonify({
        "page": page,
        "limit": limit,
        "count": len(output),
        "total": total,
        "results": output,
    }), 200

# ===============================
# ALLOCATE ALL
# ===============================

@order_bp.route("/orders/<int:order_id>/allocate-all", methods=["POST"])
def allocate_all(order_id):
    db = g.db

    order = db.get(Order, order_id)
    if not order:
        return jsonify({"error": "Order not found"}), 404

    if order.status == OrderStatus.COMPLETED.value:
        return jsonify({"error": "Cannot allocate a completed order"}), 400

    created = []

    for item in order.items:

        # Sum existing pending allocations
        pending_qty = sum(
            abs(tx.quantity_delta)
            for tx in item.transactions
            if tx.state == TransactionState.PENDING.value
        )

        remaining = (
            item.quantity_ordered
            - item.quantity_fulfilled
            - pending_qty
        )

        if remaining <= 0:
            continue

        qty_delta = (
            -remaining
            if order.type == OrderType.OUTGOING.value
            else remaining
        )

        txn = Transaction(
            product_id=item.product_id,
            order_id=order.id,
            order_item_id=item.id,
            quantity_delta=qty_delta,
            reason="allocation",
            state=TransactionState.PENDING.value,
        )

        qty = item.product.quantity

        # Apply pending effect
        if qty_delta < 0:
            qty.reserved += remaining
        else:
            qty.ordered += remaining

        db.add(txn)
        created.append(txn)

    db.commit()

    return jsonify({
        "message": f"{len(created)} items allocated",
        "transactions_created": len(created),
    }), 201


# ===============================
# CREATE ORDER FROM QUICKBOOKS
# ===============================

def get_or_create_qb_supplier(db):
    """
    Get or create a default supplier for QuickBooks items.
    
    Args:
        db: Database session
        
    Returns:
        Supplier object
        
    Raises:
        Exception: If supplier creation fails
    """
    supplier_name = "QuickBooks"
    supplier = db.execute(
        select(Supplier).where(Supplier.name == supplier_name)
    ).scalar_one_or_none()
    
    if not supplier:
        try:
            supplier = Supplier(name=supplier_name)
            db.add(supplier)
            db.flush()
        except Exception as e:
            # Re-query in case another transaction created it concurrently
            supplier = db.execute(
                select(Supplier).where(Supplier.name == supplier_name)
            ).scalar_one_or_none()
            if not supplier:
                raise Exception(f"Failed to create QuickBooks supplier: {str(e)}")
    
    return supplier


@order_bp.route("/orders/from-qb", methods=["POST"])
def create_order_from_qb():
    """
    Create a new order from QuickBooks data.
    
    Automatically creates MiscItem products for unmatched QuickBooks items.
    Unmatched items are associated with a "QuickBooks" supplier that is 
    created automatically if it doesn't exist.
    
    Expects JSON body with:
    {
        "reference_number": "8800",
        "qb_doc_type": "sales_order" | "estimate" | "invoice"
    }
    
    Returns:
        JSON with order details, including:
        - new_products: Array of newly created MiscItem products
        - new_products_created: Count of new products created
        - created_items: All order items created
        - skipped_items: Items that were skipped (if any)
    """
    db = g.db
    data = request.get_json() or {}
    
    # Validate required fields
    reference_number = data.get("reference_number")
    qb_doc_type = data.get("qb_doc_type", "").lower()
    
    if not reference_number:
        return jsonify({"error": "reference_number is required"}), 400
    
    # Validate reference_number format (alphanumeric, hyphens, underscores)
    if not isinstance(reference_number, str) or not reference_number.strip():
        return jsonify({"error": "reference_number must be a non-empty string"}), 400
    
    reference_number = reference_number.strip()
    
    # Check for duplicate order
    existing_order = db.execute(
        select(Order).where(Order.external_order_number == reference_number)
    ).scalar_one_or_none()
    
    if existing_order:
        return jsonify({
            "error": "Order with this reference number already exists",
            "existing_order_id": existing_order.id,
            "existing_order_number": existing_order.order_number
        }), 409  # Conflict status code
    
    if qb_doc_type not in ["sales_order", "salesorder", "estimate", "invoice"]:
        return jsonify({
            "error": "qb_doc_type must be one of: sales_order, salesorder, estimate, invoice"
        }), 400
    
    # Normalize qb_doc_type (salesorder -> sales_order)
    entity_type = qb_doc_type.replace("salesorder", "sales_order")
    
    # Query QuickBooks via the QB agent
    qb_agent_url = os.getenv("QB_AGENT_URL", "http://127.0.0.1:5055")
    
    try:
        response = requests.post(
            f"{qb_agent_url}/jobs",
            json={
                "op": "query",
                "entity": entity_type,
                "params": {"refnumber": reference_number}
            },
            timeout=60
        )
        response.raise_for_status()
        qb_result = response.json()
    except requests.RequestException as e:
        return jsonify({
            "error": "Failed to connect to QuickBooks service",
            "details": str(e)
        }), 502  # Bad Gateway - external service failure
    
    # Check if QB query was successful
    if not qb_result.get("success"):
        return jsonify({
            "error": "QuickBooks query failed",
            "qb_error": qb_result.get("errorMessage"),
            "qb_error_code": qb_result.get("errorCode")
        }), 400
    
    # Parse the QBXML response
    qbxml_response = qb_result.get("qbxmlResponse", "")
    
    try:
        line_items = parse_qb_line_items(qbxml_response, entity_type)
        metadata = extract_qb_metadata(qbxml_response, entity_type)
    except ValueError as e:
        return jsonify({
            "error": "Failed to parse QuickBooks response",
            "details": str(e)
        }), 400
    
    if not line_items:
        return jsonify({
            "error": "No line items found in QuickBooks response"
        }), 400
    
    # Find or create customer based on QB customer name
    customer = None
    customer_name = metadata.get("customer_name")
    if customer_name:
        customer = db.execute(
            select(Customer).where(Customer.name == customer_name)
        ).scalar_one_or_none()
        
        # Create customer if doesn't exist
        if not customer:
            customer = Customer(name=customer_name)
            db.add(customer)
            db.flush()
    
    # Create the order
    order = Order(
        type=OrderType.OUTGOING.value,  # Sales orders/estimates/invoices are outgoing
        customer_id=customer.id if customer else None,
        external_order_number=reference_number,
        description=metadata.get("memo", f"QB {entity_type.replace('_', ' ').title()} #{reference_number}"),
        status=OrderStatus.PENDING.value
    )
    
    db.add(order)
    db.flush()  # Get order.id
    
    # Generate AFC order number
    order.order_number = f"AFC-{order.id:06d}"
    
    # Get or create QB supplier once (used for auto-created MiscItems)
    qb_supplier = None
    
    # Process line items
    created_items = []
    new_products = []  # Track newly created MiscItems
    skipped_items = []
    position = 0
    
    try:
        for qb_line in line_items:
            if qb_line.get("is_separator"):
                # Create separator item
                separator = OrderItem(
                    order_id=order.id,
                    product_id=None,
                    is_separator=True,
                    quantity_ordered=0,
                    quantity_fulfilled=0,
                    note=qb_line.get("description", ""),
                    position=position
                )
                db.add(separator)
                created_items.append({
                    "type": "separator",
                    "description": qb_line.get("description", "")
                })
                position += 1
            else:
                # Find product by name (from QB item name)
                item_name = qb_line.get("name", "").strip()
                
                # Validate item name
                if not item_name:
                    skipped_items.append({
                        "name": "(empty)",
                        "reason": "Item name is empty or missing"
                    })
                    position += 1
                    continue
                
                product = find_product_by_name(db, item_name)
                
                if not product:
                    # Create a new MiscItem for unmatched QB items
                    if qb_supplier is None:
                        qb_supplier = get_or_create_qb_supplier(db)
                    
                    # Validate and truncate name if necessary (max 100 chars)
                    validated_name = item_name[:100]
                    
                    # Validate and truncate description if necessary (max 255 chars)
                    description = qb_line.get("description", "") or ""
                    validated_description = description[:255]
                    
                    # Create MiscItem
                    misc_item = MiscItem(
                        name=validated_name,
                        description=validated_description,
                        supplier_id=qb_supplier.id
                    )
                    db.add(misc_item)
                    db.flush()
                    
                    # Create associated Product (category_id for Misc Items)
                    product = Product(
                        category_id=MISC_ITEM_CATEGORY_ID,
                        reference_id=misc_item.id
                    )
                    db.add(product)
                    db.flush()
                    
                    # Create Quantity record
                    qty = Quantity(
                        product_id=product.id,
                        on_hand=0,
                        reserved=0,
                        ordered=0,
                        location=0
                    )
                    db.add(qty)
                    db.flush()
                    
                    # Track newly created product
                    new_products.append({
                        "name": validated_name,
                        "description": validated_description,
                        "product_id": product.id,
                        "misc_item_id": misc_item.id
                    })

                
                # Validate quantity
                quantity = qb_line.get("quantity", 0)
                if quantity < 0:
                    quantity = 0
                
                # Create order item
                order_item = OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    is_separator=False,
                    quantity_ordered=int(quantity),
                    quantity_fulfilled=0,
                    note=qb_line.get("description"),
                    position=position
                )
                db.add(order_item)
                created_items.append({
                    "type": "product",
                    "name": item_name,
                    "quantity": quantity
                })
                position += 1
        
        db.commit()
    except Exception as e:
        db.rollback()
        return jsonify({
            "error": "Failed to create order items",
            "details": str(e)
        }), 500
    
    return jsonify({
        "message": "Order created successfully from QuickBooks",
        "order_id": order.id,
        "order_number": order.order_number,
        "external_order_number": order.external_order_number,
        "customer_name": customer.name if customer else None,
        "items_created": len(created_items),
        "new_products_created": len(new_products),
        "items_skipped": len(skipped_items),
        "created_items": created_items,
        "new_products": new_products,
        "skipped_items": skipped_items,
        "metadata": metadata
    }), 201


def find_product_by_name(db, item_name: str):
    """
    Find a product in the database by matching the QB item name.
    Tries to match against air filter part numbers and misc item names.
    
    Args:
        db: Database session
        item_name: QuickBooks item name to search for
    
    Returns:
        Product object if found, None otherwise
    """
    if not item_name:
        return None
    
    # First try exact matches
    air_filter = db.execute(
        select(AirFilter).where(
            or_(
                AirFilter.part_number == item_name,
                func.lower(AirFilter.part_number) == item_name.lower()
            )
        )
    ).first()
    
    if air_filter and air_filter[0].product:
        return air_filter[0].product
    
    # Try misc items
    misc_item = db.execute(
        select(MiscItem).where(
            or_(
                MiscItem.name == item_name,
                func.lower(MiscItem.name) == item_name.lower()
            )
        )
    ).first()
    
    if misc_item and misc_item[0].product:
        return misc_item[0].product
    
    return None
