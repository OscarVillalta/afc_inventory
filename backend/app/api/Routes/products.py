from pprint import pp
from flask import g, jsonify, Blueprint
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database.models import Product, ProductCategory, AirFilter, MiscItem, Quantity, Supplier, ChildProduct
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
            selectinload(Product.misc_item).selectinload(MiscItem.supplier),
            selectinload(Product.child_products).selectinload(ChildProduct.air_filter).selectinload(AirFilter.supplier),
            selectinload(Product.child_products).selectinload(ChildProduct.misc_item).selectinload(MiscItem.supplier)
        )
    ).scalars().first()

    if not product:
        return jsonify({"error": "Product not found"}), 404

    category = product.category.name if product.category else "Unknown"

    if product.quantity:
        quantity = product.quantity.to_dict()
        quantity["available"] = product.quantity.available
        quantity["backordered"] = product.quantity.backordered
    

    if product.air_filter:
        details = product.air_filter.to_dict()
        details["supplier_name"] = product.air_filter.supplier.name if product.air_filter.supplier else None
    elif product.misc_item:
        details = product.misc_item.to_dict()
        details["supplier_name"] = product.misc_item.supplier.name if product.misc_item.supplier else None
    else:
        details = {}

    # Include child products
    child_products_data = []
    for child in product.child_products:
        if child.is_active:
            child_category = child.category.name if child.category else "Unknown"
            if child.air_filter:
                child_details = child.air_filter.to_dict()
                child_details["supplier_name"] = child.air_filter.supplier.name if child.air_filter.supplier else None
            elif child.misc_item:
                child_details = child.misc_item.to_dict()
                child_details["supplier_name"] = child.misc_item.supplier.name if child.misc_item.supplier else None
            else:
                child_details = {}
            
            child_products_data.append({
                "id": child.id,
                "category": child_category,
                "reference_id": child.reference_id,
                "details": child_details
            })

    return jsonify({
        "id": product.id,
        "category": category,
        "reference_id": product.reference_id,
        "details": details,
        "quantity": quantity,
        "child_products": child_products_data
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

@product_bp.route("/products/<int:id>", methods=["DELETE"])
def delete_product(id):
    return jsonify({"error": "Products cannot be deleted. Archive instead."}), 409

# =====================================================
# 🔹 GET all product names (for searches and such)
# =====================================================
@product_bp.route("/products/names", methods=["GET"])
def get_products_names():
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

        # --- Determine which subtable applies ---
        if p.category.name == "Air Filters":
            details = p.air_filter.to_dict()["part_number"]
        elif p.category.name == "Miscelaneous Items":
            details = p.misc_item.to_dict()["name"]
        else:
            details = None

        response.append({
            "id": p.id,
            "category": category,
            "part_number": details,
        })

    return jsonify(response), 200
