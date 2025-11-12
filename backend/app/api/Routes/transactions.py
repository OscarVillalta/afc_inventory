from flask import g, jsonify, request, Blueprint
from sqlalchemy import select, func
from database.models import Quantity, Transaction, Product
from datetime import datetime, timezone
from app.api.Schemas.transaction_schema import TransactionSchema
from marshmallow import ValidationError

transaction_bp = Blueprint("transactions", __name__)
txn_schema = TransactionSchema()
txn_list_schema = TransactionSchema(many=True)

@transaction_bp.route("/transactions", methods=["GET"])
def get_transactions():
    db = g.db
    page = request.args.get("page", default=1, type=int)
    limit = request.args.get("limit", default=25, type=int)
    offset = (page - 1) * limit

    query = select(Transaction).offset(offset).limit(limit)
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
    order_id = request.args.get("order_id", type=int)
    state = request.args.get("state")

    # --- Pagination
    page = request.args.get("page", default=1, type=int)
    limit = request.args.get("limit", default=25, type=int)
    offset = (page - 1) * limit

    # --- Build base query
    query = select(Transaction)
    filters = []

    if product_id:
        filters.append(Transaction.product_id == product_id)
    if order_id:
        filters.append(Transaction.order_id == order_id)
    if state:
        filters.append(Transaction.state == state)

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
    try:
        data = txn_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    # Verify product exists
    product = db.get(Product, data["product_id"])
    if not product:
        return jsonify({"error": "Invalid product_id"}), 400

    txn = Transaction.from_dict(data)
    db.add(txn)
    db.commit()

    return jsonify({
        "message": "Transaction created successfully (pending).",
        "transaction": txn_schema.dump(txn)
    }), 201

@transaction_bp.route("/transactions/<int:txn_id>/commit", methods=["PATCH"])
def commit_transaction(txn_id):
    db = g.db
    txn = db.get(Transaction, txn_id)
    if not txn:
        return jsonify({"error": "Transaction not found"}), 404

    try:
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
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 400

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
