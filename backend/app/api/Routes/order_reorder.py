from flask import Blueprint, g, request, jsonify
from sqlalchemy import select, update
from marshmallow import ValidationError

from database.models import OrderSection, OrderItem
from app.api.Schemas.reorder_schema import ReorderSectionsSchema

order_reorder_bp = Blueprint("order_reorder", __name__)
reorder_sections_schema = ReorderSectionsSchema()


@order_reorder_bp.route("/orders/<int:order_id>/sections/reorder", methods=["PATCH"])
def reorder_order_sections(order_id):
    db = g.db

    try:
        payload = reorder_sections_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    section_ids = [s["id"] for s in payload["sections"]]

    # Validate ownership
    existing = db.execute(
        select(OrderSection.id)
        .where(
            OrderSection.order_id == order_id,
            OrderSection.id.in_(section_ids)
        )
    ).scalars().all()

    if len(existing) != len(section_ids):
        return jsonify({"error": "One or more sections do not belong to this order"}), 400

    # Apply updates atomically
    with db.begin():
        for s in payload["sections"]:
            db.execute(
                update(OrderSection)
                .where(OrderSection.id == s["id"])
                .values(sort_order=s["sort_order"])
            )

    return jsonify({"message": "Order sections reordered successfully"}), 200

from app.api.Schemas.reorder_schema import ReorderItemsSchema

reorder_items_schema = ReorderItemsSchema()

@order_reorder_bp.route("/order_sections/<int:section_id>/items/reorder", methods=["PATCH"])
def reorder_section_items(section_id):
    db = g.db

    try:
        payload = reorder_items_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    item_ids = [i["id"] for i in payload["items"]]

    existing = db.execute(
        select(OrderItem.id)
        .where(
            OrderItem.section_id == section_id,
            OrderItem.id.in_(item_ids)
        )
    ).scalars().all()

    if len(existing) != len(item_ids):
        return jsonify({"error": "One or more items do not belong to this section"}), 400

    with db.begin():
        for item in payload["items"]:
            db.execute(
                update(OrderItem)
                .where(OrderItem.id == item["id"])
                .values(sort_order=item["sort_order"])
            )

    return jsonify({"message": "Order items reordered successfully"}), 200

from app.api.Schemas.reorder_schema import MoveOrderItemSchema
from database.models import OrderSection

move_item_schema = MoveOrderItemSchema()

@order_reorder_bp.route("/order_items/<int:item_id>/move", methods=["PATCH"])
def move_order_item(item_id):
    db = g.db

    try:
        payload = move_item_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    item = db.get(OrderItem, item_id)
    if not item:
        return jsonify({"error": "Order item not found"}), 404

    target_section = db.get(OrderSection, payload["to_section_id"])
    if not target_section:
        return jsonify({"error": "Target section not found"}), 404

    # Ensure same order
    if item.order_id != target_section.order_id:
        return jsonify({"error": "Cannot move item across orders"}), 400

    with db.begin():
        item.section_id = payload["to_section_id"]
        item.sort_order = payload["sort_order"]

    return jsonify({"message": "Order item moved successfully"}), 200
