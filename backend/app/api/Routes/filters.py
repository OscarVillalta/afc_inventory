from flask import g, jsonify, request, Blueprint
from sqlalchemy import select
from database.models import Filter
from marshmallow import ValidationError
from app.api.Schemas.filters_schema import FilterSchema

filter_bp = Blueprint("filters", __name__)
filter_schema = FilterSchema()


# --- GET all filters ---
@filter_bp.route("/filters", methods=["GET"])
def get_filters():
    db = g.db
    results = db.execute(select(Filter)).scalars().all()
    return jsonify([flt.to_dict() for flt in results]), 200


# --- GET single filter ---
@filter_bp.route("/filters/<int:id>", methods=["GET"])
def get_filter(id):
    db = g.db
    flt = db.execute(select(Filter).where(Filter.id == id)).scalars().first()
    if not flt:
        return jsonify({"error": "Filter not found"}), 404
    return jsonify(flt.to_dict()), 200


# --- POST new filter ---
@filter_bp.route("/filters", methods=["POST"])
def create_filter():
    db = g.db
    try:
        data = filter_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    new_filter = Filter.from_dict(data)
    db.add(new_filter)
    db.commit()
    return jsonify(filter_schema.dump(new_filter)), 201


# --- PATCH (partial update) ---
@filter_bp.route("/filters/<int:id>", methods=["PATCH"])
def update_filter(id):
    db = g.db
    flt = db.execute(select(Filter).where(Filter.id == id)).scalars().first()
    if not flt:
        return jsonify({"error": "Filter not found"}), 404

    try:
        data = filter_schema.load(request.get_json(), partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    for key, value in data.items():
        setattr(flt, key, value)

    db.commit()
    return jsonify(filter_schema.dump(flt)), 200


# --- PUT (full replacement) ---
@filter_bp.route("/filters/<int:id>", methods=["PUT"])
def replace_filter(id):
    db = g.db
    flt = db.execute(select(Filter).where(Filter.id == id)).scalars().first()
    if not flt:
        return jsonify({"error": "Filter not found"}), 404

    try:
        data = filter_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    for key, value in data.items():
        setattr(flt, key, value)

    db.commit()
    return jsonify(filter_schema.dump(flt)), 200


# --- DELETE ---
@filter_bp.route("/filters/<int:id>", methods=["DELETE"])
def delete_filter(id):
    db = g.db
    flt = db.execute(select(Filter).where(Filter.id == id)).scalars().first()
    if not flt:
        return jsonify({"error": "Filter not found"}), 404

    db.delete(flt)
    db.commit()
    return jsonify({"message": "Filter deleted successfully."}), 200
