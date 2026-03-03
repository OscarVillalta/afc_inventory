from flask import Blueprint, g, jsonify, request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, DatabaseError
from database.models import Order, OrderTracker, OrderHistory, Department, OutgoingOrderType
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
