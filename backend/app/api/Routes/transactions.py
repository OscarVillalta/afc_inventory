from flask import abort, g, jsonify, request, Blueprint
from sqlalchemy import select, func, or_
from database.models import Quantity, Transaction, Product, ChildProduct, TransactionState, OrderType, Order, OrderItem, AirFilter
from datetime import datetime, timezone
from app.api.Schemas.transaction_schema import TransactionSchema

class InventoryConflictError(Exception):
    pass

transaction_bp = Blueprint("transactions", __name__)
txn_schema = TransactionSchema()
txn_list_schema = TransactionSchema(many=True)


def validate_product_or_child_product_exclusive(data):
    """Validate that either product_id or child_product_id is provided, but not both"""
    has_product = "product_id" in data and data["product_id"] is not None
    has_child = "child_product_id" in data and data["child_product_id"] is not None
    
    if not has_product and not has_child:
        return {"error": "Either product_id or child_product_id is required"}, 400
    
    if has_product and has_child:
        return {"error": "Cannot specify both product_id and child_product_id"}, 400
    
    return None


@transaction_bp.route("/transactions", methods=["GET"])
def get_transactions():
    db = g.db
    page = request.args.get("page", default=1, type=int)
    limit = request.args.get("limit", default=25, type=int)
    offset = (page - 1) * limit

    query = select(Transaction).offset(offset).limit(limit).order_by(Transaction.id.desc())
    txns = db.execute(query).scalars().all()

    total_count = db.execute(
    select(func.count()).select_from(Transaction)
    ).scalar()

    return jsonify({
        "page": page,
        "limit": limit,
        "total": total_count,
        "results": txn_list_schema.dump(txns)
    }), 200

@transaction_bp.route("/transactions/<int:txn_id>", methods=["GET"])
def get_transaction(txn_id):
    db = g.db
    txn = db.get(Transaction, txn_id)
    if not txn:
        return jsonify({"error": "Transaction not found"}), 404
    return jsonify(txn_schema.dump(txn)), 200

@transaction_bp.route("/transactions/search", methods=["GET"])
def filter_transactions():
    db = g.db

    # --- Filters
    product_id = request.args.get("product_id", type=int)
    child_product_id = request.args.get("child_product_id", type=int)
    product_name = request.args.get("product_name", type=str)
    order_id = request.args.get("order_id", type=int)
    state = request.args.get("state")
    reason = request.args.get("reason", type=str)
    note = request.args.get("note", type=str)
    
    # Date filters
    start_date = request.args.get("start_date", type=str)
    end_date = request.args.get("end_date", type=str)
    before_date = request.args.get("before_date", type=str)
    after_date = request.args.get("after_date", type=str)

    # --- Pagination
    page = request.args.get("page", default=1, type=int)
    limit = request.args.get("limit", default=25, type=int)
    offset = (page - 1) * limit

    # --- Build base query
    query = select(Transaction)
    filters = []

    if product_id:
        filters.append(Transaction.product_id == product_id)
    
    if child_product_id:
        filters.append(Transaction.child_product_id == child_product_id)
    
    # Search by product name (partial match) - check both Product and ChildProduct
    if product_name:
        AirFilter_subquery = select(AirFilter.id).where(
            AirFilter.part_number.ilike(f"%{product_name}%")
        )

        # Products with matching air filters
        product_subquery = select(Product.id).where(
            Product.reference_id.in_(AirFilter_subquery)
        )
        
        # Child products with matching air filters
        child_product_subquery = select(ChildProduct.id).where(
            ChildProduct.reference_id.in_(AirFilter_subquery)
        )

        filters.append(
            or_(
                Transaction.product_id.in_(product_subquery),
                Transaction.child_product_id.in_(child_product_subquery)
            )
        )
    
    if order_id:
        filters.append(Transaction.order_id == order_id)
    if state:
        filters.append(Transaction.state == state)
    
    # Filter by reason (partial match, case insensitive)
    if reason:
        filters.append(Transaction.reason.ilike(f"%{reason}%"))
    
    # Filter by note (partial match, case insensitive)
    if note:
        filters.append(Transaction.note.ilike(f"%{note}%"))
    
    # Date filters
    try:
        if start_date and end_date:
            # Between two dates (inclusive)
            filters.append(Transaction.created_at >= datetime.fromisoformat(start_date))
            filters.append(Transaction.created_at <= datetime.fromisoformat(end_date))
        elif before_date:
            # Before a specific date (inclusive)
            filters.append(Transaction.created_at <= datetime.fromisoformat(before_date))
        elif after_date:
            # After a specific date (inclusive)
            filters.append(Transaction.created_at >= datetime.fromisoformat(after_date))
    except ValueError:
        return jsonify({"error": "Invalid date format. Use ISO format (YYYY-MM-DD)."}), 400

    if filters:
        query = query.where(*filters)

    # --- Apply pagination and ordering
    query = query.order_by(Transaction.created_at.desc()).offset(offset).limit(limit)

    # --- Execute paginated query
    txns = db.execute(query).scalars().all()

    # --- Get total count (with same filters)
    total_count_query = select(func.count()).select_from(Transaction)
    if filters:
        total_count_query = total_count_query.where(*filters)
    total_count = db.execute(total_count_query).scalar()

    # --- Return paginated response
    return jsonify({
        "page": page,
        "limit": limit,
        "total": total_count,
        "results": txn_list_schema.dump(txns)
    }), 200


@transaction_bp.route("/transactions", methods=["POST"])
def create_transaction():
    db = g.db
    data = request.get_json() or {}

    # Validate that either product_id or child_product_id is provided (but not both)
    validation_error = validate_product_or_child_product_exclusive(data)
    if validation_error:
        return jsonify(validation_error[0]), validation_error[1]

    required_fields = ["quantity_delta", "reason"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"{field} is required"}), 400

    # Get the product or child_product and its quantity
    product = None
    child_product = None
    qty_record = None
    
    if "product_id" in data and data["product_id"] is not None:
        product = db.get(Product, data["product_id"])
        if not product or not product.quantity:
            return jsonify({"error": "Product or quantity record not found"}), 404
        qty_record = product.quantity
    else:
        child_product = db.get(ChildProduct, data["child_product_id"])
        if not child_product:
            return jsonify({"error": "Child product not found"}), 404
        qty_record = child_product.quantity
        if not qty_record:
            return jsonify({"error": "Parent product's quantity record not found"}), 404

    order = None
    order_item = None

    if data.get("order_id"):
        order = db.get(Order, data["order_id"])
        if not order:
            return jsonify({"error": "Order not found"}), 404

    if data.get("order_item_id"):
        order_item = db.get(OrderItem, data["order_item_id"])
        if not order_item:
            return jsonify({"error": "Order item not found"}), 404

    qty_delta = int(data["quantity_delta"])
    abs_qty = abs(qty_delta)

    # ===============================
    # Safety checks for order items
    # ===============================
    if order_item:
        remaining = order_item.quantity_ordered - order_item.quantity_fulfilled

        if abs_qty > remaining:
            return jsonify({
                "error": "Quantity exceeds remaining order item amount"
            }), 400

    # ===============================
    # Create PENDING transaction
    # ===============================
    txn = Transaction(
        product_id=product.id if product else None,
        child_product_id=child_product.id if child_product else None,
        order_id=order.id if order else None,
        order_item_id=order_item.id if order_item else None,
        quantity_delta=qty_delta,
        reason=data["reason"],
        note=data.get("note"),
        state=TransactionState.PENDING.value,
    )

    # ===============================
    # Apply PENDING inventory effect
    # ===============================
    if qty_delta < 0 :
        qty_record.reserved += abs_qty
    else :
       qty_record.ordered += abs_qty 


    db.add(txn)
    db.flush()

    #Auto_commit check

    auto_commit_flag = request.args.get("auto_commit") == "true"

    if auto_commit_flag:
        txn.commit()

    db.commit()

    return jsonify({
        "id": txn.id,
        "state": txn.state,
        "quantity_delta": txn.quantity_delta,
        "reason": txn.reason,
        "note": txn.note,
        "created_at": txn.created_at.isoformat(),
    }), 201


@transaction_bp.route("/transactions/<int:txn_id>/commit", methods=["PATCH"])
def commit_transaction(txn_id):
    db = g.db
    txn = db.get(Transaction, txn_id)

    if not txn:
        return jsonify({"error": "Transaction not found"}), 404

    try:
        if txn.state != "pending":
            return jsonify({ "error": "Transaction is not pending"}), 400


        if txn.quantity_delta < 0:  # outgoing
            # Get quantity from the appropriate source
            qty_record = txn._get_quantity_record()
            qty = abs(txn.quantity_delta)

            if qty > qty_record.on_hand:
                return jsonify({ "error": f"Not enough inventory. On hand: {qty_record.on_hand}, required: {qty}"}), 409
   
        txn.commit()
        db.commit()
        return jsonify({
            "message": "Transaction committed successfully.",
            "transaction": txn_schema.dump(txn)
        }), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 400

@transaction_bp.route("/transactions/<int:txn_id>/cancel", methods=["PATCH"])
def cancel_transaction(txn_id):
    db = g.db
    txn = db.get(Transaction, txn_id)
    if not txn:
        return jsonify({"error": "Transaction not found"}), 404
    
    try:
        txn.cancel()
        db.commit()

        return jsonify({
            "message": "Transaction cancelled successfully.",
            "transaction": txn_schema.dump(txn)
        }), 200
    
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 400



@transaction_bp.route("/transactions/<int:txn_id>/rollback", methods=["PATCH"])
def rollback_transaction(txn_id):
    db = g.db
    txn = db.get(Transaction, txn_id)

    if not txn:
        return jsonify({"error": "Transaction not found"}), 404

    try:
        new_txn = txn.rollback(db)
        db.commit()
        return jsonify({
            "message": "Transaction rolled back successfully.",
            "original_transaction": txn_schema.dump(txn),
            "rollback_transaction": txn_schema.dump(new_txn)
        }), 200

    except InventoryConflictError as e:
        db.rollback()
        return jsonify({"error": str(e)}), 409

    except ValueError as e:
        db.rollback()
        return jsonify({"error": str(e)}), 400

    except Exception:
        db.rollback()
        return jsonify({"error": "Unexpected error while rolling back transaction"}), 500

# =====================================================
# 🔹 GET Ledger for a Product
# =====================================================
@transaction_bp.route("/transactions/ledger/<int:product_id>", methods=["GET"])
def get_transaction_ledger(product_id):
    db = g.db

    # Ensure product exists
    product = db.get(Product, product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    # --- Query parameters
    page = request.args.get("page", default=1, type=int)
    limit = request.args.get("limit", default=50, type=int)
    offset = (page - 1) * limit
    start_date = request.args.get("start_date", type=str)
    end_date = request.args.get("end_date", type=str)
    include_pending = request.args.get("include_pending", "false").lower() == "true"

    # --- Build filters
    filters = [Transaction.product_id == product_id]
    try:
        if start_date:
            filters.append(Transaction.created_at >= datetime.fromisoformat(start_date))
        if end_date:
            filters.append(Transaction.created_at <= datetime.fromisoformat(end_date))
    except ValueError:
        return jsonify({"error": "Invalid date format. Use ISO format (YYYY-MM-DD)."}), 400
    
    if not include_pending:
        filters.append(Transaction.state == "committed")

    # --- Define running balance (chronological)
    running_balance = func.sum(Transaction.quantity_delta).over(
        order_by=Transaction.created_at
    ).label("running_balance")

    # --- Main query (DESC output)
    query = (
        select(
            Transaction.id,
            Transaction.created_at,
            Transaction.reason,
            Transaction.quantity_delta,
            Transaction.state,
            Transaction.note,
            running_balance,
        )
        .where(*filters)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    # Execute paginated ledger
    results = db.execute(query).mappings().all()

    # Total count & final balance
    total_count = db.execute(
        select(func.count()).select_from(Transaction).where(*filters)
    ).scalar()

    final_balance = (
        db.execute(
            select(func.sum(Transaction.quantity_delta))
            .where(Transaction.product_id == product_id)
            .where(Transaction.state == "committed")
        ).scalar()
        or 0
    )

    return jsonify({
        "product_id": product_id,
        "page": page,
        "limit": limit,
        "total": total_count,
        "final_balance": final_balance,
        "results": [dict(row) for row in results],
    }), 200


# =====================================================
# 🔹 GET Ledger for a Child Product
# =====================================================
@transaction_bp.route("/transactions/ledger/child_product/<int:child_product_id>", methods=["GET"])
def get_child_product_transaction_ledger(child_product_id):
    db = g.db

    # Ensure child product exists
    child_product = db.get(ChildProduct, child_product_id)
    if not child_product:
        return jsonify({"error": "Child product not found"}), 404

    # --- Query parameters
    page = request.args.get("page", default=1, type=int)
    limit = request.args.get("limit", default=50, type=int)
    offset = (page - 1) * limit
    start_date = request.args.get("start_date", type=str)
    end_date = request.args.get("end_date", type=str)
    include_pending = request.args.get("include_pending", "false").lower() == "true"

    # --- Build filters
    filters = [Transaction.child_product_id == child_product_id]
    try:
        if start_date:
            filters.append(Transaction.created_at >= datetime.fromisoformat(start_date))
        if end_date:
            filters.append(Transaction.created_at <= datetime.fromisoformat(end_date))
    except ValueError:
        return jsonify({"error": "Invalid date format. Use ISO format (YYYY-MM-DD)."}), 400
    
    if not include_pending:
        filters.append(Transaction.state == "committed")

    # --- Define running balance (chronological)
    running_balance = func.sum(Transaction.quantity_delta).over(
        order_by=Transaction.created_at
    ).label("running_balance")

    # --- Main query (DESC output)
    query = (
        select(
            Transaction.id,
            Transaction.created_at,
            Transaction.reason,
            Transaction.quantity_delta,
            Transaction.state,
            Transaction.note,
            running_balance,
        )
        .where(*filters)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    # Execute paginated ledger
    results = db.execute(query).mappings().all()

    # Total count & final balance
    total_count = db.execute(
        select(func.count()).select_from(Transaction).where(*filters)
    ).scalar()

    final_balance = (
        db.execute(
            select(func.sum(Transaction.quantity_delta))
            .where(Transaction.child_product_id == child_product_id)
            .where(Transaction.state == "committed")
        ).scalar()
        or 0
    )

    return jsonify({
        "child_product_id": child_product_id,
        "page": page,
        "limit": limit,
        "total": total_count,
        "final_balance": final_balance,
        "results": [dict(row) for row in results],
    }), 200

