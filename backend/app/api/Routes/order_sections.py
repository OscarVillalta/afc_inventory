from flask import Blueprint, g, request, jsonify
from sqlalchemy import select, func
from marshmallow import ValidationError

from database.models import Order, OrderSection, OrderItem
from app.api.Schemas.order_section_schema import OrderSectionSchema

order_section_bp = Blueprint("order_sections", __name__)
section_schema = OrderSectionSchema()
section_schema_many = OrderSectionSchema(many=True)

@order_section_bp.route("/order_sections", methods=["POST"])
def create_order_section():
    db = g.db

    try:
        data = section_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    order = db.get(Order, data["order_id"])
    if not order:
        return jsonify({"error": "Order not found"}), 404

    if "sort_order" not in data:
        max_sort = db.execute(
            select(func.coalesce(func.max(OrderSection.sort_order), 0))
            .where(OrderSection.order_id == data["order_id"])
        ).scalar_one()
        data["sort_order"] = max_sort + 1

    section = OrderSection(**data)
    db.add(section)
    db.commit()

    return jsonify(section_schema.dump(section)), 201

@order_section_bp.route("/orders/<int:order_id>/sections", methods=["GET"])
def get_order_sections(order_id):
    db = g.db
    order = db.get(Order, order_id)

    if not order:
        return jsonify({"error": "Order not found"}), 404

    sections = []
    for section in sorted(order.sections, key=lambda s: s.sort_order):
        sections.append({
            "id": section.id,
            "title": section.title,
            "description": section.description,
            "sort_order": section.sort_order,
            "status": section.status,
            "items": [
                {
                    "id": item.id,
                    "product_id": item.product.id,
                    "status": item.status,
                    "part_number": (
                        item.product.air_filter.part_number
                        if item.product.air_filter
                        else item.product.misc_item.name
                    ),
                    "quantity_ordered": item.quantity_ordered,
                    "quantity_fulfilled": item.quantity_fulfilled,
                    "note": item.note,
                }
                for item in section.items
            ],
        })

    return jsonify(sections), 200


@order_section_bp.route("/order_sections/<int:section_id>", methods=["GET"])
def get_order_section(section_id):
    db = g.db

    section = db.get(OrderSection, section_id)
    if not section:
        return jsonify({"error": "Order section not found"}), 404

    return jsonify(section_schema.dump(section)), 200

@order_section_bp.route("/order_sections/<int:section_id>", methods=["PATCH"])
def update_order_section(section_id):
    db = g.db

    section = db.get(OrderSection, section_id)
    if not section:
        return jsonify({"error": "Order section not found"}), 404

    try:
        data = section_schema.load(request.get_json(), partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    for key, value in data.items():
        setattr(section, key, value)

    db.commit()
    return jsonify(section_schema.dump(section)), 200

@order_section_bp.route("/order_sections/<int:section_id>", methods=["DELETE"])
def delete_order_section(section_id):
    db = g.db

    section = db.get(OrderSection, section_id)
    if not section:
        return jsonify({"error": "Order section not found"}), 404

    item_count = db.execute(
        select(func.count(OrderItem.id))
        .where(OrderItem.section_id == section_id)
    ).scalar_one()

    if item_count > 0:
        return jsonify({
            "error": "Cannot delete section with order items"
        }), 400

    db.delete(section)
    db.commit()

    return jsonify({"message": "Order section deleted"}), 200

