from pprint import pp
from flask import g, jsonify, Blueprint, request
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
        
        # Get effective quantity (from parent if applicable)
        effective_qty = p.get_effective_quantity()
        quantity = effective_qty.to_dict() if effective_qty else {}

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
            "parent_product_id": p.parent_product_id,
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
    
    # Get effective quantity (from parent if applicable)
    effective_qty = product.get_effective_quantity()
    quantity = effective_qty.to_dict() if effective_qty else {}

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
        "parent_product_id": product.parent_product_id,
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

@product_bp.route("/products/<int:id>", methods=["DELETE"])
def delete_product(id):
    return jsonify({"error": "Products cannot be deleted. Archive instead."}), 409


@product_bp.route("/products/<int:id>/parent", methods=["PATCH"])
def update_product_parent(id):
    """Update the parent_product_id of a product"""
    db = g.db
    product = db.get(Product, id)
    
    if not product:
        return jsonify({"error": "Product not found"}), 404
    
    data = request.get_json() or {}
    parent_product_id = data.get("parent_product_id")
    
    # Validate parent product if provided
    if parent_product_id is not None:
        if parent_product_id == id:
            return jsonify({"error": "Product cannot be its own parent"}), 400
            
        parent_product = db.get(Product, parent_product_id)
        if not parent_product:
            return jsonify({"error": "Invalid parent product ID"}), 400
            
        # Ensure parent has its own quantity (not a child product)
        if parent_product.parent_product_id:
            return jsonify({"error": "Parent product cannot itself be a child product"}), 400
        
        # Check if this would create a circular reference
        # (if any child of this product is the proposed parent)
        if product.child_products:
            for child in product.child_products:
                if child.id == parent_product_id:
                    return jsonify({"error": "Circular reference detected"}), 400
    
    # Update the parent_product_id
    old_parent = product.parent_product_id
    product.parent_product_id = parent_product_id
    
    # If changing from standalone to child, we should keep the quantity but it won't be used
    # If changing from child to standalone, create a quantity if it doesn't exist
    if old_parent is not None and parent_product_id is None:
        # Becoming standalone - ensure it has a quantity
        if not product.quantity:
            qty = Quantity(product_id=product.id, on_hand=0, reserved=0, ordered=0, location=0)
            db.add(qty)
    
    db.commit()
    
    return jsonify({
        "message": "Product parent updated successfully",
        "product_id": product.id,
        "parent_product_id": product.parent_product_id
    }), 200

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
            details = {}

        response.append({
            "id": p.id,
            "category": category,
            "part_number": details,
        })

    return jsonify(response), 200
