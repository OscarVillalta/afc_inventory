from flask import g, jsonify, request, Blueprint
from sqlalchemy import select
from database.models import Filter, Quantity, Transaction
from datetime import datetime, timezone
from app.api.Schemas.transaction_schema import TransactionSchema
from marshmallow import ValidationError

transaction_bp = Blueprint("transactions", __name__)
transaction_schema = TransactionSchema()

@transaction_bp.route("/inventory/adjust", methods=["POST"])
@transaction_bp.route("/inventory/adjust", methods=["POST"])
def adjust_inventory():
    db = g.db

    try:
        data = transaction_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    filter_id = data["filter_id"]
    qty_change = data["quantity"]
    reason = data["reason"]
    note = data.get("note")

    qty_row = db.execute(
        select(Quantity).where(Quantity.filter_id == filter_id)
    ).scalars().first()

    if not qty_row:
        return jsonify({"error": "Inventory record not found for this filter"}), 404

    # ✅ correct transaction handling
    try:
        # 1️⃣ Create transaction log
        tx = Transaction(
            filter_id=filter_id,
            quantity=qty_change,
            reason=reason,
            note=note
        )
        db.add(tx)

        # 2️⃣ Update inventory count
        qty_row.on_hand += qty_change

        if qty_row.on_hand < 0:
            raise ValueError("Inventory cannot go negative")

        db.commit()  # ✅ explicitly commit

        return jsonify({
            "message": "Inventory updated successfully",
            "new_on_hand": qty_row.on_hand,
            "transaction": tx.to_dict()
        }), 200

    except ValueError as ve:
        db.rollback()  # ✅ safe, since we're NOT inside db.begin()
        return jsonify({"error": str(ve)}), 400

    except Exception as e:
        db.rollback()  # ✅ safe rollback
        return jsonify({"error": "Transaction failed", "details": str(e)}), 500