from flask import g, jsonify, request, Blueprint
from sqlalchemy import select
from database.models import Quantity, Filter
from marshmallow import ValidationError
from app.api.Schemas.quantity_schema import QuantitySchema

quantity_bp = Blueprint("quantities", __name__)
quantity_schema = QuantitySchema()


# --- GET all quantity ---
@quantity_bp.route("/quantities", methods=["GET"])
def get_quantity():
    db = g.db
    results = db.execute(select(Quantity)).scalars().all()
    return jsonify([qty.to_dict() for qty in results]), 200


# --- GET single quantity ---
@quantity_bp.route("/quantities/<int:id>", methods=["GET"])
def get_quantities(id):
    db = g.db
    qty = db.execute(select(Quantity).where(Quantity.id == id)).scalars().first()
    if not qty:
        return jsonify({"error": "Quantity not found"}), 404
    return jsonify(qty.to_dict()), 200


# --- POST new Quantity ---
@quantity_bp.route("/quantities", methods=["POST"])
def create_quantity():
    db = g.db
    try:
        data = quantity_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    #Check if filter already has qty

    filter = db.execute(
        select(Quantity).where(Quantity.filter_id == data["filter_id"])
    ).first()

    if filter:
        return jsonify({
            "error": "Cannot create quantity as filter_id is already used by another quantity"
        }), 400

    new_quantity = Quantity.from_dict(data)
    db.add(new_quantity)
    db.commit()
    return jsonify(quantity_schema.dump(new_quantity)), 201


# --- PATCH (partial update) ---
@quantity_bp.route("/quantities/<int:id>", methods=["PATCH"])
def update_quantity(id):
    db = g.db
    qty = db.execute(select(Quantity).where(Quantity.id == id)).scalars().first()
    if not qty:
        return jsonify({"error": "Quantity not found"}), 404

    try:
        data = quantity_schema.load(request.get_json(), partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    for key, value in data.items():
        setattr(qty, key, value)

    db.commit()
    return jsonify(quantity_schema.dump(qty)), 200


# --- PUT (full replacement) ---
@quantity_bp.route("/quantities/<int:id>", methods=["PUT"])
def replace_quantity(id):
    db = g.db
    qty = db.execute(select(Quantity).where(Quantity.id == id)).scalars().first()
    if not qty:
        return jsonify({"error": "Quantity not found"}), 404

    try:
        data = quantity_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    for key, value in data.items():
        setattr(qty, key, value)

    db.commit()
    return jsonify(quantity_schema.dump(qty)), 200


# --- DELETE ---
@quantity_bp.route("/quantities/<int:id>", methods=["DELETE"])
def delete_quantity(id):
    db = g.db
    qty = db.execute(select(Quantity).where(Quantity.id == id)).scalars().first()
    if not qty:
        return jsonify({"error": "Quantity not found"}), 404

    db.delete(qty)
    db.commit()
    return jsonify({"message": "Quantity deleted successfully."}), 200
