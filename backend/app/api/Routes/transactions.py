from flask import g, jsonify, request, Blueprint
from sqlalchemy import select
from database.models import Quantity, Transaction, Product
from datetime import datetime, timezone
from app.api.Schemas.transaction_schema import TransactionSchema
from marshmallow import ValidationError

transaction_bp = Blueprint("transactions", __name__)
transaction_schema = TransactionSchema()


@transaction_bp.route("/inventory/adjust", methods=["POST"])
def adjust_inventory():
    db = g.db

    # --- Validate input ---
    try:
        data = transaction_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    product_id = data["product_id"]
    qty_change = data["quantity"]
    reason = data["reason"]
    note = data.get("note")

    # --- Get quantity record ---
    qty_row = db.execute(
        select(Quantity).where(Quantity.product_id == product_id)
    ).scalars().first()

    if not qty_row:
        return jsonify({"error": "No inventory record found for this product"}), 404

    # --- Ensure the Product actually exists (optional safety check) ---
    product_exists = db.execute(
        select(Product.id).where(Product.id == product_id)
    ).scalar_one_or_none()
    if not product_exists:
        return jsonify({"error": "Product not found"}), 404

    # --- Perform transaction ---
    try:
        # 1️⃣ Create transaction log
        tx = Transaction(
            product_id=product_id,
            quantity=qty_change,
            reason=reason,
            note=note,
            created_at=datetime.now(timezone.utc)
        )
        db.add(tx)

        # 2️⃣ Adjust inventory count
        qty_row.on_hand += qty_change

        if qty_row.on_hand < 0:
            raise ValueError("Inventory cannot go negative")

        db.commit()  # commit both updates and transaction log

        return jsonify({
            "message": "Inventory updated successfully",
            "new_on_hand": qty_row.on_hand,
            "transaction": tx.to_dict()
        }), 200

    except ValueError as ve:
        db.rollback()
        return jsonify({"error": str(ve)}), 400

    except Exception as e:
        db.rollback()
        return jsonify({
            "error": "Transaction failed",
            "details": str(e)
        }), 500
