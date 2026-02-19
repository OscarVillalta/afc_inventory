from flask import g, jsonify, Blueprint
from sqlalchemy import func, select, and_, or_
from database.models import Product, Quantity, ChildProduct


inventory_stats_bp = Blueprint("inventory_stats", __name__)


@inventory_stats_bp.route("/inventory/stats", methods=["GET"])
def get_inventory_stats():
    db = g.db

    # Only count parent products (those that have a Quantity row)
    base = (
        select(
            func.count(Quantity.id).label("total_skus"),
            func.coalesce(func.sum(Quantity.reserved), 0).label("reserved_total"),
            func.coalesce(func.sum(Quantity.ordered), 0).label("ordered_total"),
            func.count()
            .filter(Quantity.on_hand <= 0)
            .label("low_stock_skus"),
            func.count()
            .filter(
                and_(
                    Quantity.reserved > 0,
                    Quantity.on_hand < Quantity.reserved,
                )
            )
            .label("backordered_skus"),
        )
        .select_from(Quantity)
        .join(Product, Product.id == Quantity.product_id)
    )

    row = db.execute(base).mappings().one()

    return jsonify({
        "total_skus": row["total_skus"],
        "low_stock_skus": row["low_stock_skus"],
        "backordered_skus": row["backordered_skus"],
        "reserved_total": int(row["reserved_total"]),
        "ordered_total": int(row["ordered_total"]),
    }), 200
