from flask import Blueprint, g, jsonify, request
from sqlalchemy import select, func
from sqlalchemy import and_, or_
from app.api.Schemas.order_schema import OrderSchema
from database.models import Customer, Supplier, OrderType, OrderStatus
from database.models import Order
from marshmallow import ValidationError
from datetime import datetime, timedelta

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
    type_filter = request.args.get("type")          # "incoming" | "outgoing"
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

    # Determine customer or supplier name
    cs_name = None
    cs_id = None
    if order.type == OrderType.OUTGOING.value and order.customer:
        cs_id = order.customer.id
        cs_name = order.customer.name

    elif order.type == OrderType.INCOMING.value and order.supplier:
        cs_id = order.supplier.id
        cs_name = order.supplier.name

    return jsonify({
        "id": order.id,
        "order_number": order.order_number,
        "type": order.type,
        "cs_id": cs_id,
        "cs_name": cs_name,
        "status": order.status,
        "description": order.description,
        "created_at": order.created_at.strftime("%Y-%m-%d"),
        "completed_at": (
            order.completed_at.strftime("%Y-%m-%d")
            if order.completed_at else None
        ),
        "eta": (
            order.eta.strftime("%Y-%m-%d")
            if order.eta else None
        ),
    }), 200


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

@order_bp.route("/orders/<int:order_id>", methods=["PATCH"])
def patch_order(order_id):
    db = g.db
    order = db.get(Order, order_id)

    if not order:
        return jsonify({"error": "Order not found"}), 404

    data = request.get_json() or {}

    # ===============================
    # ❌ Disallowed fields
    # ===============================
    for forbidden in ("status", "completed_at", "order_number"):
        if forbidden in data:
            return jsonify({
                "error": f"'{forbidden}' cannot be modified"
            }), 400
        
    # ===============================
    # Type validation
    # ===============================

    if "type" in data:
        new_type = data["type"]

        if new_type not in (
            OrderType.OUTGOING.value,
            OrderType.INCOMING.value,
        ):
            return jsonify({"error": "Invalid order type"}), 400

        order.type = new_type

    # ===============================
    # Customer / Supplier assignment
    # ===============================
    if "cs_id" in data:
        cs_id = data["cs_id"]

        if not cs_id:
            return jsonify({"error": "cs_id cannot be empty"}), 400

        if order.type == OrderType.OUTGOING.value:
            order.customer_id = cs_id
            order.supplier_id = None
        elif order.type == OrderType.INCOMING.value:
            order.supplier_id = cs_id
            order.customer_id = None

    # ===============================
    # Description
    # ===============================
    if "description" in data:
        order.description = data["description"]

    # ===============================
    # Created At (date only)
    # ===============================
    if "created_at" in data:
        try:
            order.created_at = datetime.strptime(
                data["created_at"], "%Y-%m-%d"
            )
        except ValueError:
            return jsonify({
                "error": "created_at must be YYYY-MM-DD"
            }), 400

    # ===============================
    # ETA (optional, must be >= created_at)
    # ===============================
    if "eta" in data:
        if data["eta"] is None:
            order.eta = None
        else:
            try:
                eta = datetime.strptime(
                    data["eta"], "%Y-%m-%d"
                ).date()
                created = order.created_at.date()

                if eta < created:
                    return jsonify({
                        "error": "ETA cannot be earlier than created date"
                    }), 400

                order.eta = eta
            except ValueError:
                return jsonify({
                    "error": "eta must be YYYY-MM-DD"
                }), 400
            
    if "supplier_id" in data:
        order.supplier_id = data["supplier_id"]

    db.commit()

    # ===============================
    # Return updated order (same shape as GET)
    # ===============================
    cs_name = None
    if order.type == OrderType.OUTGOING.value and order.customer:
        cs_name = order.customer.name
    elif order.type == OrderType.INCOMING.value and order.supplier:
        cs_name = order.supplier.name

    return jsonify({
        "id": order.id,
        "order_number": order.order_number,
        "type": order.type,
        "cs_name": cs_name,
        "status": order.status,
        "description": order.description,
        "created_at": order.created_at.strftime("%Y-%m-%d"),
        "completed_at": (
            order.completed_at.strftime("%Y-%m-%d")
            if order.completed_at else None
        ),
        "eta": (
            order.eta.strftime("%Y-%m-%d")
            if order.eta else None
        ),
    }), 200

def parse_date(date_str: str):
    return datetime.strptime(date_str, "%Y-%m-%d")

@order_bp.route("/orders/search", methods=["GET"])
def search_orders():
    db = g.db

    # ---------------- Query Params ----------------
    order_id = request.args.get("id")
    order_number = request.args.get("order_number")
    order_type = request.args.get("type")  # customer | supplier
    name = request.args.get("name")
    status = request.args.get("status")
    created_from = request.args.get("reated_from")
    created_to = request.args.get("created_to")
    completed_from = request.args.get("completed_from")
    completed_to = request.args.get("completed_to")

    page = request.args.get("page", default=1, type=int)
    limit = request.args.get("limit", default=25, type=int)
    offset = (page - 1) * limit

    # ---------------- Base Query ----------------
    query = (
        select(
            Order.id,
            Order.order_number,
            Order.type,
            Order.status,
            Order.description,
            Order.created_at,

            # Dynamic name resolution
            Customer.name.label("customer_name"),
            Supplier.name.label("supplier_name"),
        )
        .outerjoin(Customer, Order.customer_id == Customer.id)
        .outerjoin(Supplier, Order.supplier_id == Supplier.id)
    )

    # ---------------- Filters ----------------
    filters = []

    if order_id:
        filters.append(Order.id.ilike(f"%{order_id}%"))

    if order_number:
        filters.append(Order.order_number.ilike(f"%{order_number}%"))

    if order_type:
        filters.append(Order.type == order_type)

    if status:
        filters.append(Order.status == status)
    
    if created_from:
        query = query.filter(
            Order.created_at >= parse_date(created_from)
        )

    if created_to:
        query = query.filter(
            Order.created_at < parse_date(created_to) + timedelta(days=1)
        )

    if completed_from:
        query = query.filter(
            Order.completed_at >= parse_date(completed_from)
        )

    if completed_to:
        query = query.filter(
            Order.completed_at < parse_date(completed_to) + timedelta(days=1)
    )

    if name:
        filters.append(
            or_(
                Customer.name.ilike(f"%{name}%"),
                Supplier.name.ilike(f"%{name}%"),
            )
        )

    if filters:
        query = query.where(and_(*filters))

    # ---------------- Total Count ----------------
    total = db.execute(query).mappings().all()
    total_count = len(total)

    # ---------------- Pagination ----------------
    paginated = query.limit(limit).offset(offset)
    results = db.execute(paginated).mappings().all()

    # ---------------- Normalize Output ----------------
    output = []
    for row in results:
        row = dict(row)
        row["cs_name"] = row["customer_name"] or row["supplier_name"]
        row.pop("customer_name")
        row.pop("supplier_name")
        output.append(row)

    return jsonify({
        "page": page,
        "limit": limit,
        "count": len(output),
        "total": total_count,
        "results": output,
    }), 200

