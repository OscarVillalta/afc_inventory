from flask import g, jsonify, request, Blueprint
from sqlalchemy import select, and_
from database.models import Filter, Supplier, Quantity
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

# --- SEARCH QUERY ---

@filter_bp.route("/filters/search", methods=["GET"])
def search():
    db = g.db

    # --- Query parameters ---
    part_number = request.args.get("part_number")
    supplier_name = request.args.get("supplier")
    rating = request.args.get("rating", type=int)
    height = request.args.get("height", type=int)
    width = request.args.get("width", type=int)
    depth = request.args.get("depth", type=int)
    location = request.args.get("location")

    # Pagination
    page = request.args.get("page", default=1, type=int)
    limit = request.args.get("limit", default=25, type=int)
    offset = (page - 1) * limit

    # --- Base query ---
    query = (
        select(
            Filter.part_number,
            Supplier.name.label("supplier_name"),
            Filter.rating,
            Filter.height,
            Filter.width,
            Filter.depth,
            Quantity.on_hand,
            Quantity.reserved,
            Quantity.ordered,
        )
        .join(Supplier, Filter.supplier_id == Supplier.id)
        .join(Quantity, Filter.id == Quantity.filter_id)
    )

    # --- Dynamic filters ---
    filters = [] # <- search filters
    if part_number:
        filters.append(Filter.part_number.ilike(f"%{part_number}%"))
    if supplier_name:
        filters.append(Supplier.name.ilike(f"%{supplier_name}%"))
    if rating is not None:
        filters.append(Filter.rating == rating)
    if height is not None:
        filters.append(Filter.height == height)
    if width is not None:
        filters.append(Filter.width == width)
    if depth is not None:
        filters.append(Filter.depth == depth)
    if location:
        filters.append(Quantity.location.ilike(f"%{location}%"))

    # Apply filters if any
    if filters:
        query = query.where(and_(*filters))
    else:
        # 🧩 Optional safeguard — if no filters, cap results to avoid heavy load
        query = query.limit(min(limit, 100))

    # --- Apply pagination ---
    query = query.limit(limit).offset(offset)

    # --- Execute query ---
    results = db.execute(query).mappings().all()

    # --- Return JSON response ---
    return jsonify({
        "page": page,
        "limit": limit,
        "results": results,
        "count": len(results)
    }), 200
