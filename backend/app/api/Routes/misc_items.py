from flask import g, jsonify, request, Blueprint
from sqlalchemy import select
from marshmallow import ValidationError
from database.models import MiscItem, Supplier, Product, ProductCategory
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

    new_product = Product(
        category_id=product_category.id,
        reference_id=misc_item.id
    )
    db.add(new_product)
    db.commit()

    return jsonify({
        "message": "Misc item created successfully.",
        "misc_item": misc_schema.dump(misc_item),
        "product_id": new_product.id
    }), 201


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
