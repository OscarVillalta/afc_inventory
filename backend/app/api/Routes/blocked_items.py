from flask import g, jsonify, request, Blueprint
from sqlalchemy import select, and_, or_
from marshmallow import ValidationError
from database.models import BlockedItem, Supplier, Product, Quantity, ChildProduct
from app.api.Schemas.blocked_items_schema import BlockedItemSchema

blocked_item_bp = Blueprint("blocked_items", __name__)
blocked_item_schema = BlockedItemSchema()

# =====================================================
# 🔹 GET all blocked items
# =====================================================
@blocked_item_bp.route("/blocked_items", methods=["GET"])
def get_blocked_items():
    db = g.db
    results = db.execute(select(BlockedItem)).scalars().all()
    return jsonify(blocked_item_schema.dump(results)), 200


# =====================================================
# 🔹 GET single blocked item
# =====================================================
@blocked_item_bp.route("/blocked_items/<int:id>", methods=["GET"])
def get_blocked_item(id):
    db = g.db
    item = db.execute(select(BlockedItem).where(BlockedItem.id == id)).scalars().first()
    if not item:
        return jsonify({"error": "Blocked item not found"}), 404
    return jsonify(blocked_item_schema.dump(item)), 200


# =====================================================
# 🔹 POST new blocked item
# =====================================================
@blocked_item_bp.route("/blocked_items", methods=["POST"])
def create_blocked_item():
    db = g.db

    try:
        data = blocked_item_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400


    # Check name uniqueness
    existing = db.execute(
        select(BlockedItem).where(BlockedItem.name == data["name"])
    ).scalar_one_or_none()
    if existing:
        return jsonify({"error": "A blocked item with this name already exists"}), 409

    # Create the BlockedItem
    blocked_item = BlockedItem.from_dict(data)
    db.add(blocked_item)
    db.commit()

    return jsonify({
        "message": "Blocked item created successfully.",
        "blocked_item": blocked_item_schema.dump(blocked_item),
    }), 201


# =====================================================
# 🔹 PATCH (partial update)
# =====================================================
@blocked_item_bp.route("/blocked_items/<int:id>", methods=["PATCH"])
def update_blocked_item(id):
    db = g.db
    item = db.execute(select(BlockedItem).where(BlockedItem.id == id)).scalars().first()
    if not item:
        return jsonify({"error": "Blocked item not found"}), 404

    try:
        data = blocked_item_schema.load(request.get_json(), partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    # Check name uniqueness if name is being updated
    if "name" in data and data["name"] != item.name:
        existing = db.execute(
            select(BlockedItem).where(BlockedItem.name == data["name"])
        ).scalar_one_or_none()
        if existing:
            return jsonify({"error": "A blocked item with this name already exists"}), 409

    for key, value in data.items():
        setattr(item, key, value)

    db.commit()
    return jsonify(blocked_item_schema.dump(item)), 200


# =====================================================
# 🔹 DELETE
# =====================================================
@blocked_item_bp.route("/blocked_items/<int:id>", methods=["DELETE"])
def delete_blocked_item(id):
    db = g.db
    item = db.execute(select(BlockedItem).where(BlockedItem.id == id)).scalars().first()
    if not item:
        return jsonify({"error": "Blocked item not found"}), 404

    db.delete(item)
    db.commit()

    return jsonify({"message": "Blocked item and related product deleted successfully."}), 200


# =====================================================
# 🔹 SEARCH blocked items (with filters & pagination)
# =====================================================
@blocked_item_bp.route("/blocked_items/search", methods=["GET"])
def search_blocked_items():
    db = g.db

    # --- Query parameters ---
    name = request.args.get("name")


    # Pagination
    page = request.args.get("page", default=1, type=int)
    limit = request.args.get("limit", default=25, type=int)
    offset = (page - 1) * limit

    # --- Base Query ---
    query = (
        select(
            BlockedItem.id,
            BlockedItem.name,
        )
        .join(Supplier, BlockedItem.supplier_id == Supplier.id)
        .distinct(BlockedItem.id)
    )

    # --- Dynamic Filters ---
    filters = []

    if name:
        filters.append(BlockedItem.name.ilike(f"%{name}%"))

    if filters:
        query = query.where(and_(*filters))

    # --- Total Count ---
    total = len(db.execute(query).mappings().all())

    # --- Pagination ---
    query = query.limit(limit).offset(offset)

    # --- Execute ---
    results = db.execute(query).mappings().all()
    results = [dict(row) for row in results]

    return jsonify({
        "page": page,
        "limit": limit,
        "count": len(results),
        "total": total,
        "results": results
    }), 200
