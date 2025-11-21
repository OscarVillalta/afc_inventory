from flask import g, jsonify, Blueprint
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database.models import Product, ProductCategory, AirFilter, MiscItem, Quantity, Supplier
from app.api.Schemas.product_schema import ProductSchema

product_bp = Blueprint("products", __name__)
product_schema = ProductSchema()
product_list_schema = ProductSchema(many=True)

# =====================================================
# 🔹 GET all products (joined data: Air + Misc + Quantity)
# =====================================================
@product_bp.route("/products", methods=["GET"])
def get_products():
    db = g.db

    # Use selectinload to minimize round-trips
    results = db.execute(
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.quantity),
            selectinload(Product.air_filter).selectinload(AirFilter.supplier),
            selectinload(Product.misc_item).selectinload(MiscItem.supplier)
        )
    ).scalars().all()

    response = []
    for p in results:
        category = p.category.name if p.category else "Unknown"
        quantity = p.quantity.to_dict() if p.quantity else {}

        # --- Determine which subtable applies ---
        if p.air_filter:
            details = p.air_filter.to_dict()
            details["supplier_name"] = p.air_filter.supplier.name if p.air_filter.supplier else None
        elif p.misc_item:
            details = p.misc_item.to_dict()
            details["supplier_name"] = p.misc_item.supplier.name if p.misc_item.supplier else None
        else:
            details = {}

        response.append({
            "id": p.id,
            "category": category,
            "reference_id": p.reference_id,
            "details": details,
            "quantity": quantity
        })

    return jsonify(response), 200


# =====================================================
# 🔹 GET single product (joined)
# =====================================================
@product_bp.route("/products/<int:id>", methods=["GET"])
def get_product(id):
    db = g.db

    product = db.execute(
        select(Product)
        .where(Product.id == id)
        .options(
            selectinload(Product.category),
            selectinload(Product.quantity),
            selectinload(Product.air_filter).selectinload(AirFilter.supplier),
            selectinload(Product.misc_item).selectinload(MiscItem.supplier)
        )
    ).scalars().first()

    if not product:
        return jsonify({"error": "Product not found"}), 404

    category = product.category.name if product.category else "Unknown"
    quantity = product.quantity.to_dict() if product.quantity else {}

    if product.air_filter:
        details = product.air_filter.to_dict()
        details["supplier_name"] = product.air_filter.supplier.name if product.air_filter.supplier else None
    elif product.misc_item:
        details = product.misc_item.to_dict()
        details["supplier_name"] = product.misc_item.supplier.name if product.misc_item.supplier else None
    else:
        details = {}

    return jsonify({
        "id": product.id,
        "category": category,
        "reference_id": product.reference_id,
        "details": details,
        "quantity": quantity
    }), 200


@product_bp.route("/products/<int:id>/archive", methods=["PATCH"])
def archive_product(id):
    db = g.db
    product = db.get(Product, id)

    if not product:
        return jsonify({"error": "Product not found"}), 404

    if not product.is_active:
        return jsonify({"message": "Product already archived"}), 200

    # Soft delete
    product.is_active = False
    db.commit()

    return jsonify({"message": "Product archived successfully"}), 200
