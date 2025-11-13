from flask import Blueprint, g, jsonify, request
from sqlalchemy import select, func
from app.api.Schemas.order_schema import OrderSchema
from database.models import Order
from marshmallow import ValidationError

order_bp = Blueprint("orders", __name__)
order_schema = OrderSchema()
order_list_schema = OrderSchema(many=True)

# GET all orders (paginated, filterable)
@order_bp.route("/orders", methods=["GET"])
def get_orders():
    db = g.db
    page = request.args.get("page", default=1, type=int)
    limit = request.args.get("limit", default=25, type=int)
    offset = (page - 1) * limit

    # --- Optional filters
    type_filter = request.args.get("type")          # "supplier" | "customer"
    status_filter = request.args.get("status")      # "Pending", "Completed"
    search = request.args.get("search", "")         # keyword in order_number or description

    query = select(Order)
    if type_filter:
        query = query.where(Order.type == type_filter)
    if status_filter:
        query = query.where(Order.status == status_filter)
    if search:
        query = query.where(Order.order_number.ilike(f"%{search}%"))

    query = query.order_by(Order.created_at.desc()).offset(offset).limit(limit)
    results = db.execute(query).scalars().all()

    total = db.execute(
        select(func.count()).select_from(Order)
    ).scalar()

    return jsonify({
        "page": page,
        "limit": limit,
        "total": total,
        "results": order_list_schema.dump(results)
    }), 200


# GET single order with items
@order_bp.route("/orders/<int:order_id>", methods=["GET"])
def get_order(order_id):
    db = g.db
    order = db.get(Order, order_id)
    if not order:
        return jsonify({"error": "Order not found"}), 404

    return jsonify(order_schema.dump(order)), 200


# Create new order
@order_bp.route("/orders", methods=["POST"])
def create_order():
    db = g.db
    try:
        data = order_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    order = Order.from_dict(data)
    db.add(order)
    db.commit()

    return jsonify({
        "message": "Order created successfully.",
        "order": order_schema.dump(order)
    }), 201


# PATCH: Force update status (recalculate)
@order_bp.route("/orders/<int:order_id>/status", methods=["PATCH"])
def update_order_status(order_id):
    db = g.db
    order = db.get(Order, order_id)
    if not order:
        return jsonify({"error": "Order not found"}), 404

    order.update_status()
    db.commit()

    return jsonify({
        "message": "Order status updated.",
        "status": order.status
    }), 200
