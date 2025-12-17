from flask import Blueprint, g, jsonify, request
from sqlalchemy import select, func
from app.api.Schemas.order_item_schema import OrderItemSchema
from database.models import OrderItem, Order, Product, Transaction, OrderSection, TransactionState, OrderType
from marshmallow import ValidationError

order_item_bp = Blueprint("order_items", __name__)
item_schema = OrderItemSchema()
item_list_schema = OrderItemSchema(many=True)

# 🔹 GET a single order item
@order_item_bp.route("/order_items/<int:item_id>", methods=["GET"])
def get_order_item(item_id):
    db = g.db
    item = db.get(OrderItem, item_id)
    if not item:
        return jsonify({"error": "Order item not found"}), 404

    return jsonify(item_schema.dump(item)), 200

# 🔹 POST: Create new order item
@order_item_bp.route("/order_items", methods=["POST"])
def create_order_item():
    db = g.db
    try:
        data = item_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    order_section = db.get(OrderSection, data["order_section_id"])
    if not order_section:
        return jsonify({"error": "Invalid order_section_id "}), 400
    product = db.get(Product, data["product_id"])
    if not product:
        return jsonify({"error": "Invalid product_id"}), 400

    # Create and link item
    item = OrderItem.from_dict(data)
    db.add(item)
    db.commit()

    return jsonify({
        "message": "Order item added successfully.",
        "item": item_schema.dump(item)
    }), 201

# 🔹 PATCH: Update general info (quantity/note)
@order_item_bp.route("/order_items/<int:item_id>", methods=["PATCH"])
def update_order_item(item_id):
    db = g.db
    item = db.get(OrderItem, item_id)
    if not item:
        return jsonify({"error": "Order item not found"}), 404

    # Only editable if not yet fulfilled
    if item.quantity_fulfilled > 0:
        return jsonify({"error": "Cannot modify fulfilled order item"}), 400

    data = request.get_json()
    if "quantity_ordered" in data:
        item.quantity_ordered = data["quantity_ordered"]
    if "note" in data:
        item.note = data["note"]

    db.commit()
    return jsonify({
        "message": "Order item updated successfully.",
        "item": item_schema.dump(item)
    }), 200

@order_item_bp.route("/order_items/<int:item_id>/allocate", methods=["POST"])
def allocate_order_item(item_id):
    db = g.db
    item = db.get(OrderItem, item_id)
    if not item:
        return jsonify({"error": "Order item not found"}), 404

    order = item.order
    if not order:
        return jsonify({"error": "Order not associated"}), 400

    # 🔹 Parse requested allocation quantity
    body = request.get_json(silent=True) or {}
    qty_to_allocate = body.get("quantity")

    try:
        qty_to_allocate = int(qty_to_allocate)
    except (ValueError, TypeError):
        return jsonify({"error": "Quantity must be an integer."}), 400

    if qty_to_allocate is None or qty_to_allocate <= 0:
        return jsonify({"error": "A positive 'quantity' is required for allocation."}), 400

    note = body.get("note")

    # 🔹 Determine direction and reason
    sign = 1 if order.type == "supplier" else -1
    qty_delta = qty_to_allocate * sign
    reason = "receive" if order.type == "supplier" else "shipment"

    # 🔹 Compute total already allocated (pending + committed)
    existing_qty = db.scalar(
        select(func.coalesce(func.sum(Transaction.quantity_delta), 0))
        .where(Transaction.order_item_id == item.id)
        .where(Transaction.state.in_(["pending", "committed"]))
    ) or 0

    projected_total = existing_qty + qty_to_allocate

    # 🔹 Prevent over-allocation
    if abs(projected_total) > abs(item.quantity_ordered):
        return jsonify({
            "error": "Allocation exceeds quantity ordered.",
            "ordered": item.quantity_ordered,
            "allocated_so_far": existing_qty,
            "attempted_allocation": qty_to_allocate
        }), 400

    # 🔹 Create pending transaction
    txn = Transaction(
        product_id=item.product_id,
        order_id=order.id,
        order_item_id=item.id,
        quantity_delta=qty_delta,
        reason=reason,
        state="pending",
        note=note or None
    )

    db.add(txn)
    order.update_status()
    db.commit()

    return jsonify({
        "message": f"Allocated {qty_to_allocate} unit(s) for order item {item_id}.",
        "transaction": txn.to_dict(),
        "order_status": order.status
    }), 201

@order_item_bp.route("/order_items/<int:item_id>/commit", methods=["PATCH"])
def commit_single_order_item_txn(item_id):
    db = g.db
    item = db.get(OrderItem, item_id)
    if not item:
        return jsonify({"error": "Order item not found"}), 404

    order = item.order
    if not order:
        return jsonify({"error": "Order not associated"}), 400

    # 🔹 Extract txn_id if provided in the body
    data = request.get_json(silent=True) or {}
    txn_id = data.get("txn_id")

    if not txn_id:
        return jsonify({"error": "txn_id is required"}), 400

    txn = db.get(Transaction, txn_id)
    if not txn:
        return jsonify({"error": "Transaction not found"}), 404
    
    if txn.order_item_id != item.id:
        return jsonify({"error": "Transaction does not belong to this order item"}), 400

    if txn.state != "pending":
        return jsonify({"message": "Transaction already committed or cancelled"}), 200
 

    # 🔹 Perform the commit
    try:
        txn.commit()
        order.update_status()
        db.commit()

        return jsonify({
            "message": f"Transaction {txn.id} committed successfully for order item {item_id}.",
            "transaction": txn.to_dict(),
            "order_item": item.to_dict(),
            "order_status": order.status
        }), 200

    except ValueError as e:
        db.rollback()
        return jsonify({"error": f"Validation error: {str(e)}"}), 400
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


@order_item_bp.route("/order_items/<int:item_id>/commit_all", methods=["PATCH"])
def commit_all_order_item_txns(item_id):
    db = g.db
    item = db.get(OrderItem, item_id)
    if not item:
        return jsonify({"error": "Order item not found"}), 404

    order = item.order
    if not order:
        return jsonify({"error": "Order not associated"}), 400

    # 🔹 Gather all pending transactions for this line item
    pending_txns = db.scalars(
        select(Transaction)
        .where(Transaction.order_item_id == item.id)
        .where(Transaction.state == "pending")
    ).all()

    if not pending_txns:
        return jsonify({"message": "No pending transactions to commit."}), 200

    committed = 0
    try:
        for txn in pending_txns:
            txn.commit()
            committed += 1

        order.update_status()
        db.commit()

        return jsonify({
            "message": f"Committed {committed} pending transaction(s) for order item {item_id}.",
            "committed_txn_ids": [t.id for t in pending_txns],
            "order_item": item.to_dict(),
            "order_status": order.status
        }), 200

    except ValueError as e:
        db.rollback()
        return jsonify({"error": f"Validation error: {str(e)}"}), 400
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


@order_item_bp.route("/order_items/<int:id>", methods=["DELETE"])
def delete_order_item(id):
    db = g.db
    item = db.get(OrderItem, id)

    if not item:
        return jsonify({"error": "Order item not found"}), 404

    if item.transactions:
        return jsonify({
            "error": "Order item has allocation or transaction history. Cannot delete."
        }), 409

    if item.quantity_fulfilled != 0:
        return jsonify({
            "error": "Order item has fulfillment history. Cannot delete."
        }), 409

    db.delete(item)
    db.commit()

    return jsonify({"message": "Order item deleted successfully"}), 200

@order_item_bp.route("/order_items/<int:item_id>/transactions", methods=["GET"])
def get_order_item_transactions(item_id):
    db = g.db
    item = db.get(OrderItem, item_id)

    if not item:
        return jsonify({"error": "Order item not found"}), 404

    txns = (
        db.query(Transaction)
        .filter(Transaction.order_item_id == item.id)
        .order_by(Transaction.created_at.desc())
        .all()
    )

    return jsonify([
        {
            "id": t.id,
            "quantity_delta": t.quantity_delta,
            "reason": t.reason,
            "state": t.state,
            "note": t.note,
            "created_at": t.created_at.isoformat(),
        }
        for t in txns
    ]), 200

@order_item_bp.route(
    "/order-items/<int:order_item_id>/transactions",
    methods=["POST"]
)
def create_order_item_transaction(order_item_id):
    db = g.db
    data = request.get_json() or {}

    # -------------------------
    # Required fields
    # -------------------------
    quantity = data.get("quantity")
    reason = data.get("reason")
    note = data.get("note")

    if not quantity or quantity <= 0:
        return jsonify({
            "error": "quantity must be a positive number"
        }), 400

    if not reason:
        return jsonify({
            "error": "reason is required"
        }), 400

    # -------------------------
    # Load order item
    # -------------------------
    item = db.get(OrderItem, order_item_id)
    if not item:
        return jsonify({"error": "Order item not found"}), 404

    order = item.order
    product = item.product

    if not product or not product.quantity:
        return jsonify({
            "error": "Product or quantity record missing"
        }), 400

    qty = product.quantity
    remaining = item.quantity_ordered - item.quantity_fulfilled

    if quantity > remaining:
        return jsonify({
            "error": "Quantity exceeds remaining order item amount"
        }), 400

    # -------------------------
    # Create PENDING transaction
    # -------------------------
    txn = Transaction(
        product_id=product.id,
        order_id=order.id,
        order_item_id=item.id,
        quantity_delta=quantity,
        reason=reason,
        note=note,
        state=TransactionState.PENDING.value,
    )

    # -------------------------
    # Apply PENDING inventory effects
    # -------------------------
    if order.type == OrderType.OUTGOING.value:
        # Reserve stock
        if qty.on_hand < quantity:
            return jsonify({
                "error": "Insufficient on-hand stock to reserve"
            }), 400

        qty.reserved += quantity

    elif order.type == OrderType.INCOMING.value:
        # Mark as ordered
        qty.ordered += quantity

    db.add(txn)
    db.commit()

    return jsonify({
        "id": txn.id,
        "state": txn.state,
        "quantity": quantity,
        "reason": txn.reason,
        "note": txn.note,
        "created_at": txn.created_at.isoformat(),
    }), 201

