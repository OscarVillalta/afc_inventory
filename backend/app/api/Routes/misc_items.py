from flask import g, jsonify, request, Blueprint
from sqlalchemy import select, and_
from marshmallow import ValidationError
from database.models import MiscItem, Supplier, Product, Quantity
from app.api.Schemas.misc_item_schema import MiscItemSchema

misc_bp = Blueprint("misc_items", __name__)
misc_schema = MiscItemSchema()
misc_list_schema = MiscItemSchema(many=True)

product_category = 2

# =====================================================
# 🔹 GET all misc items
# =====================================================
@misc_bp.route("/misc_items", methods=["GET"])
def get_misc_items():
    db = g.db
    results = db.execute(select(MiscItem)).scalars().all()
    return jsonify(misc_list_schema.dump(results)), 200


# =====================================================
# 🔹 GET single misc item
# =====================================================
@misc_bp.route("/misc_items/<int:id>", methods=["GET"])
def get_misc_item(id):
    db = g.db
    item = db.execute(select(MiscItem).where(MiscItem.id == id)).scalars().first()
    if not item:
        return jsonify({"error": "Misc item not found"}), 404
    return jsonify(misc_schema.dump(item)), 200


# =====================================================
# 🔹 POST new misc item
# =====================================================
@misc_bp.route("/misc_items", methods=["POST"])
def create_misc_item():
    db = g.db

    try:
        data = misc_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    # Check that supplier exists
    supplier = db.execute(
        select(Supplier).where(Supplier.id == data["supplier_id"])
    ).scalar_one_or_none()
    if not supplier:
        return jsonify({"error": "Supplier not found"}), 404

    # Create the MiscItem
    misc_item = MiscItem.from_dict(data)
    db.add(misc_item)
    db.flush()

    # Create Product record with optional parent
    parent_product_id = data.get("parent_product_id")
    
    # Validate parent product if provided
    if parent_product_id:
        parent_product = db.get(Product, parent_product_id)
        if not parent_product:
            return jsonify({"error": "Invalid parent product ID"}), 400
        # Ensure parent has its own quantity (not a child product)
        if parent_product.parent_product_id:
            return jsonify({"error": "Parent product cannot itself be a child product"}), 400

    new_product = Product(
        category_id=product_category,
        reference_id=misc_item.id,
        parent_product_id=parent_product_id
    )
    db.add(new_product)
    db.flush()

    # Create Quantity record only if no parent (parent products share quantity)
    if not parent_product_id:
        qty = Quantity(product_id=new_product.id, on_hand=0, reserved=0, ordered=0, location=0)
        db.add(qty)
    
    db.commit()

    response = {
        "message": "Misc item created successfully.",
        "misc_item": misc_schema.dump(misc_item),
        "product_id": new_product.id,
    }
    
    if not parent_product_id:
        response["quantity_id"] = qty.id
    else:
        response["parent_product_id"] = parent_product_id
        response["message"] = "Misc item created successfully (sharing quantity with parent product)"
    
    return jsonify(response), 201


# =====================================================
# 🔹 PATCH (partial update)
# =====================================================
@misc_bp.route("/misc_items/<int:id>", methods=["PATCH"])
def update_misc_item(id):
    db = g.db
    item = db.execute(select(MiscItem).where(MiscItem.id == id)).scalars().first()
    if not item:
        return jsonify({"error": "Misc item not found"}), 404

    try:
        data = misc_schema.load(request.get_json(), partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    for key, value in data.items():
        setattr(item, key, value)

    db.commit()
    return jsonify(misc_schema.dump(item)), 200


# =====================================================
# 🔹 DELETE
# =====================================================
@misc_bp.route("/misc_items/<int:id>", methods=["DELETE"])
def delete_misc_item(id):
    db = g.db
    item = db.execute(select(MiscItem).where(MiscItem.id == id)).scalars().first()
    if not item:
        return jsonify({"error": "Misc item not found"}), 404

    # Delete associated product if exists
    product = db.execute(
        select(Product).where(Product.reference_id == id)
    ).scalar_one_or_none()
    if product:
        db.delete(product)

    db.delete(item)
    db.commit()

    return jsonify({"message": "Misc item and related product deleted successfully."}), 200


# =====================================================
# 🔹 SEARCH misc items (with filters & pagination)
# =====================================================
@misc_bp.route("/misc_items/search", methods=["GET"])
def search_misc_items():
    db = g.db

    # --- Query parameters ---
    name = request.args.get("name")
    description = request.args.get("description")
    supplier_name = request.args.get("supplier")

    # Pagination
    page = request.args.get("page", default=1, type=int)
    limit = request.args.get("limit", default=25, type=int)
    offset = (page - 1) * limit

    # --- Base Query ---
    # Use outerjoin and case to get quantity from parent if it exists
    from sqlalchemy import case
    
    query = (
        select(
            MiscItem.id,
            MiscItem.name,
            MiscItem.description,
            Product.id.label("product_id"),
            Product.parent_product_id,
            Supplier.name.label("supplier_name"),

            Quantity.on_hand,
            Quantity.reserved,
            Quantity.ordered,
            Quantity.location,
            Quantity.available,
            Quantity.backordered,
        )
        .join(Supplier, MiscItem.supplier_id == Supplier.id)
        .join(Product, Product.reference_id == MiscItem.id)
        .outerjoin(Quantity, Quantity.product_id == case(
            (Product.parent_product_id.isnot(None), Product.parent_product_id),
            else_=Product.id
        ))
        .where(Product.category_id == product_category)
        .distinct(MiscItem.id)
    )

    # --- Dynamic Filters ---
    filters = []

    if name:
        filters.append(MiscItem.name.ilike(f"%{name}%"))
    if description:
        filters.append(MiscItem.description.ilike(f"%{description}%"))
    if supplier_name:
        filters.append(Supplier.name.ilike(f"%{supplier_name}%"))

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
