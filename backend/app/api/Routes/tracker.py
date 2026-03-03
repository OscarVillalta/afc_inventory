from flask import Blueprint, g, jsonify, request
from sqlalchemy import select, func, or_, case, and_
from sqlalchemy.exc import IntegrityError, DatabaseError
from database.models import Order, OrderTracker, OrderHistory, Department, OutgoingOrderType, Customer, OrderType
from datetime import datetime, timezone
from typing import Tuple, Any

from app.api.error_handling import (
    handle_database_error,
    safe_commit,
    ResourceNotFoundError,
)

tracker_bp = Blueprint("tracker", __name__)


@tracker_bp.route("/orders/<int:order_id>/tracker", methods=["GET"])
def get_order_tracker(order_id: int) -> Tuple[Any, int]:
    """Return the current tracking state and full history for an order."""
    db = g.db

    order = db.get(Order, order_id)
    if not order:
        raise ResourceNotFoundError("Order", order_id)

    tracker = db.execute(
        select(OrderTracker).where(OrderTracker.order_id == order_id)
    ).scalar_one_or_none()

    history_rows = db.execute(
        select(OrderHistory)
        .where(OrderHistory.order_id == order_id)
        .order_by(OrderHistory.completed_at.asc())
    ).scalars().all()

    return jsonify({
        "order": order.to_dict(),
        "tracker": tracker.to_dict() if tracker else None,
        "history": [h.to_dict() for h in history_rows],
    }), 200


@tracker_bp.route("/orders/<int:order_id>/tracker", methods=["POST"])
def create_order_tracker(order_id: int) -> Tuple[Any, int]:
    """Initialize tracking for an order (sets current_department and step_index)."""
    db = g.db
    data = request.get_json() or {}

    order = db.get(Order, order_id)
    if not order:
        raise ResourceNotFoundError("Order", order_id)

    existing = db.execute(
        select(OrderTracker).where(OrderTracker.order_id == order_id)
    ).scalar_one_or_none()
    if existing:
        return jsonify({"error": "Tracker already exists for this order."}), 409

    current_department = data.get("current_department")
    if not current_department or current_department not in [d.value for d in Department]:
        return jsonify({
            "error": "current_department must be one of: " + ", ".join(d.value for d in Department)
        }), 400

    tracker = OrderTracker(
        order_id=order_id,
        current_department=current_department,
        step_index=data.get("step_index", 0),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(tracker)

    error = safe_commit(db)
    if error:
        return handle_database_error(error)

    return jsonify(tracker.to_dict()), 201


@tracker_bp.route("/orders/<int:order_id>/tracker", methods=["PATCH"])
def update_order_tracker(order_id: int) -> Tuple[Any, int]:
    """Advance the tracker to a new department/step."""
    db = g.db
    data = request.get_json() or {}

    order = db.get(Order, order_id)
    if not order:
        raise ResourceNotFoundError("Order", order_id)

    tracker = db.execute(
        select(OrderTracker).where(OrderTracker.order_id == order_id)
    ).scalar_one_or_none()
    if not tracker:
        return jsonify({"error": "Tracker not found for this order."}), 404

    current_department = data.get("current_department")
    if current_department is not None:
        if current_department not in [d.value for d in Department]:
            return jsonify({
                "error": "current_department must be one of: " + ", ".join(d.value for d in Department)
            }), 400
        tracker.current_department = current_department

    if "step_index" in data:
        tracker.step_index = data["step_index"]

    tracker.updated_at = datetime.now(timezone.utc)

    error = safe_commit(db)
    if error:
        return handle_database_error(error)

    return jsonify(tracker.to_dict()), 200


@tracker_bp.route("/orders/<int:order_id>/history", methods=["POST"])
def add_order_history(order_id: int) -> Tuple[Any, int]:
    """Append a history entry (department transition + action) for an order."""
    db = g.db
    data = request.get_json() or {}

    order = db.get(Order, order_id)
    if not order:
        raise ResourceNotFoundError("Order", order_id)

    department_values = [d.value for d in Department]

    to_department = data.get("to_department")
    if not to_department or to_department not in department_values:
        return jsonify({
            "error": "to_department must be one of: " + ", ".join(department_values)
        }), 400

    from_department = data.get("from_department")
    if from_department and from_department not in department_values:
        return jsonify({
            "error": "from_department must be one of: " + ", ".join(department_values)
        }), 400

    action_taken = data.get("action_taken", "").strip()
    if not action_taken:
        return jsonify({"error": "action_taken is required."}), 400

    performed_by = data.get("performed_by", "").strip()
    if not performed_by:
        return jsonify({"error": "performed_by is required."}), 400

    entry = OrderHistory(
        order_id=order_id,
        from_department=from_department,
        to_department=to_department,
        action_taken=action_taken,
        performed_by=performed_by,
        completed_at=datetime.now(timezone.utc),
        comments=data.get("comments"),
    )
    db.add(entry)

    error = safe_commit(db)
    if error:
        return handle_database_error(error)

    return jsonify(entry.to_dict()), 201


@tracker_bp.route("/packing-slips", methods=["GET"])
def get_packing_slips() -> Tuple[Any, int]:
    """Return all outgoing orders with their tracker and history info for the packing slip tracker page."""
    db = g.db

    page = request.args.get("page", default=1, type=int)
    limit = request.args.get("limit", default=25, type=int)
    search = request.args.get("search", "").strip()
    tracker_status = request.args.get("tracker_status", "").strip()  # "Not Started"|"In Progress"|"Completed"
    offset = (page - 1) * limit

    # Number of steps defined on the frontend; last index = len(DEPT_STEPS) - 1
    LAST_STEP_IDX = len([d for d in Department]) - 1  # 4 (SALES=0 … ACCOUNTING=4)

    # Base query: outgoing orders joined with customer and tracker
    base_query = (
        select(Order)
        .outerjoin(Customer, Order.customer_id == Customer.id)
        .outerjoin(OrderTracker, OrderTracker.order_id == Order.id)
        .where(Order.type == OrderType.OUTGOING.value)
    )

    if search:
        base_query = base_query.where(
            or_(
                Order.order_number.ilike(f"%{search}%"),
                Order.external_order_number.ilike(f"%{search}%"),
                Customer.name.ilike(f"%{search}%"),
            )
        )

    # Tracker status filter
    if tracker_status == "Not Started":
        base_query = base_query.where(OrderTracker.id == None)  # noqa: E711
    elif tracker_status == "In Progress":
        base_query = base_query.where(
            OrderTracker.id != None,  # noqa: E711
            OrderTracker.step_index < LAST_STEP_IDX,
        )
    elif tracker_status == "Completed":
        base_query = base_query.where(
            OrderTracker.id != None,  # noqa: E711
            OrderTracker.step_index >= LAST_STEP_IDX,
        )

    # Efficient total count using the filtered query
    total = db.execute(
        select(func.count(Order.id)).select_from(
            base_query.subquery()
        )
    ).scalar()

    orders = db.execute(
        base_query.order_by(Order.created_at.desc()).limit(limit).offset(offset)
    ).scalars().all()

    # Per-status counts for the tab badges (based on search, ignoring tracker_status)
    counts_query = (
        select(
            func.count(case((OrderTracker.id == None, 1))).label("not_started"),  # noqa: E711
            func.count(case((and_(OrderTracker.id != None, OrderTracker.step_index < LAST_STEP_IDX), 1))).label("in_progress"),  # noqa: E711
            func.count(case((and_(OrderTracker.id != None, OrderTracker.step_index >= LAST_STEP_IDX), 1))).label("completed"),  # noqa: E711
        )
        .select_from(Order)
        .outerjoin(Customer, Order.customer_id == Customer.id)
        .outerjoin(OrderTracker, OrderTracker.order_id == Order.id)
        .where(Order.type == OrderType.OUTGOING.value)
    )
    if search:
        counts_query = counts_query.where(
            or_(
                Order.order_number.ilike(f"%{search}%"),
                Order.external_order_number.ilike(f"%{search}%"),
                Customer.name.ilike(f"%{search}%"),
            )
        )
    counts_row = db.execute(counts_query).one()
    status_counts = {
        "Not Started": counts_row.not_started or 0,
        "In Progress": counts_row.in_progress or 0,
        "Completed": counts_row.completed or 0,
    }

    results = []
    for order in orders:
        tracker = order.tracker
        history = sorted(order.history, key=lambda h: h.completed_at)
        results.append({
            "id": order.id,
            "order_number": order.order_number,
            "external_order_number": order.external_order_number,
            "order_type": order.order_type,
            "status": order.status,
            "description": order.description,
            "customer_name": order.customer.name if order.customer else None,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "completed_at": order.completed_at.isoformat() if order.completed_at else None,
            "eta": order.eta.strftime("%Y-%m-%d") if order.eta else None,
            "tracker": tracker.to_dict() if tracker else None,
            "history": [h.to_dict() for h in history],
        })

    return jsonify({
        "page": page,
        "limit": limit,
        "total": total,
        "status_counts": status_counts,
        "results": results,
    }), 200
