from flask import g, jsonify, request, Blueprint
from sqlalchemy import select, and_
from database.models import AirFilter, AirFilterCategory, Supplier, Product, ProductCategory, Quantity
from marshmallow import ValidationError
from app.api.Schemas.air_filters_schema import AirFilterSchema

air_filter_bp = Blueprint("air_filters", __name__)
air_filter_schema = AirFilterSchema()

ProductCategory_id = 1

# --- GET all Air Filters ---
@air_filter_bp.route("/air-filters", methods=["GET"])
def get_air_filters():
    db = g.db
    results = db.execute(select(AirFilter)).scalars().all()
    return jsonify([flt.to_dict(include_relationships=True) for flt in results]), 200


# --- GET single Air Filter ---
@air_filter_bp.route("/air-filters/<int:id>", methods=["GET"])
def get_air_filter(id):
    db = g.db
    flt = db.get(AirFilter, id)
    if not flt:
        return jsonify({"error": "Air Filter not found"}), 404
    return jsonify(flt.to_dict(include_relationships=True)), 200


# --- POST new Air Filter ---
@air_filter_bp.route("/air-filters", methods=["POST"])
def create_air_filter():
    db = g.db
    try:
        data = air_filter_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    supplier = db.get(Supplier, data["supplier_id"])
    category = db.get(AirFilterCategory, data["category_id"])
    if not supplier or not category:
        return jsonify({"error": "Invalid supplier or category ID"}), 400

    # 1️⃣ Create AirFilter record
    new_filter = AirFilter.from_dict(data)
    db.add(new_filter)
    db.flush()

    product = Product(category_id=1, reference_id=new_filter.id)
    db.add(product)
    db.flush()

    # 3️⃣ Create Quantity record
    qty = Quantity(product_id=product.id, on_hand=0, reserved=0, ordered=0, location=0)
    db.add(qty)
    db.commit()

    return jsonify({
        "message": "Air Filter created successfully",
        "air_filter": new_filter.to_dict(include_relationships=True),
        "product_id": product.id,
        "quantity_id": qty.id
    }), 201


# --- PATCH (partial update) ---
@air_filter_bp.route("/air-filters/<int:id>", methods=["PATCH"])
def update_air_filter(id):
    db = g.db
    flt = db.get(AirFilter, id)
    if not flt:
        return jsonify({"error": "Air Filter not found"}), 404

    try:
        data = air_filter_schema.load(request.get_json(), partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    for key, value in data.items():
        setattr(flt, key, value)

    db.commit()
    return jsonify(air_filter_schema.dump(flt)), 200


# --- PUT (full replacement) ---
@air_filter_bp.route("/air-filters/<int:id>", methods=["PUT"])
def replace_air_filter(id):
    db = g.db
    flt = db.get(AirFilter, id)
    if not flt:
        return jsonify({"error": "Air Filter not found"}), 404

    try:
        data = air_filter_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    for key, value in data.items():
        setattr(flt, key, value)

    db.commit()
    return jsonify(air_filter_schema.dump(flt)), 200


# --- DELETE ---
@air_filter_bp.route("/air-filters/<int:id>", methods=["DELETE"])
def delete_air_filter(id):
    db = g.db
    flt = db.get(AirFilter, id)
    if not flt:
        return jsonify({"error": "Air Filter not found"}), 404

    # Cascade delete linked product + quantity
    if flt.product:
        db.delete(flt.product)
    db.delete(flt)
    db.commit()
    return jsonify({"message": "Air Filter deleted successfully."}), 200


# --- SEARCH QUERY ---

@air_filter_bp.route("/filters/search", methods=["GET"])
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
            Quantity.location,
            Quantity.on_hand,
            Quantity.reserved,
            Quantity.ordered,
        ).select_from(Filter)
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
        query = query.where(*filters)
    else:
        # 🧩 Optional safeguard — if no filters, cap results to avoid heavy load
        query = query.limit(min(limit, 100))

    # --- Apply pagination ---
    query = query.limit(limit).offset(offset)

    # --- Execute query ---
    results = db.execute(query).mappings().all()
    results = [dict(row) for row in results] 

    # --- Return JSON response ---
    return jsonify({
        "page": page,
        "limit": limit,
        "results": results,
        "count": len(results)
    }), 200

