from datetime import datetime, timezone
from flask import Blueprint, jsonify, request, g, current_app
from sqlalchemy import func, or_, select

from database.models import (
    Conversion,
    ConversionBatch,
    ConversionState,
    Order,
    Product,
    Transaction,
    TransactionReason,
    TransactionState,
)
from app.api.validation import validate_pagination


conversion_bp = Blueprint("conversions", __name__)


class InsufficientStockError(Exception):
    def __init__(self, product_id: int, on_hand: int, required: int):
        self.product_id = product_id
        self.on_hand = on_hand
        self.required = required
        super().__init__("Not enough inventory to convert.")


def _derive_state(conversion: Conversion) -> str:
    decrease_state = conversion.decrease_txn.state
    increase_state = conversion.increase_txn.state

    if (
        decrease_state == TransactionState.COMMITTED.value
        and increase_state == TransactionState.COMMITTED.value
    ):
        return "committed"
    if (
        decrease_state == TransactionState.ROLLED_BACK.value
        and increase_state == TransactionState.ROLLED_BACK.value
    ):
        return "rolled_back"
    return "partial"


def _serialize_conversion(conversion: Conversion) -> dict:
    decrease_txn = conversion.decrease_txn
    increase_txn = conversion.increase_txn

    return {
        "id": conversion.id,
        "batch_id": conversion.batch_id,
        "note": conversion.note,
        "created_at": conversion.created_at.isoformat(),
        "state": _derive_state(conversion),
        "decrease": {
            "product_id": decrease_txn.product_id,
            "quantity": abs(decrease_txn.quantity_delta),
            "transaction_id": decrease_txn.id,
        },
        "increase": {
            "product_id": increase_txn.product_id,
            "quantity": abs(increase_txn.quantity_delta),
            "transaction_id": increase_txn.id,
        },
    }


def _serialize_batch(batch: ConversionBatch, conversions_total: int | None = None) -> dict:
    payload = {
        "id": batch.id,
        "order_id": batch.order_id,
        "note": batch.note,
        "created_by": batch.created_by,
        "created_at": batch.created_at.isoformat(),
    }
    if conversions_total is not None:
        payload["totals"] = {"conversions": conversions_total}
    return payload


def _validate_and_get_product_with_quantity(db, product_id: int):
    product = db.get(Product, product_id)
    if not product:
        raise ValueError("Product not found.")
    if not product.quantity:
        raise ValueError("Quantity record not found for product.")
    return product, product.quantity


def _get_product_quantity_from_transaction(txn: Transaction):
    if txn.child_product:
        return txn.child_product.quantity
    if txn.product:
        return txn.product.quantity
    return None


def _validate_conversion_payload(payload: dict):
    if not isinstance(payload, dict):
        raise ValueError("Conversion payload is required.")

    decrease = payload.get("decrease") or {}
    increase = payload.get("increase") or {}

    try:
        decrease_product_id = int(decrease.get("product_id"))
        decrease_qty = int(decrease.get("quantity"))
        increase_product_id = int(increase.get("product_id"))
        increase_qty = int(increase.get("quantity"))
    except (TypeError, ValueError):
        raise ValueError("product_id and quantity must be integers.")

    if decrease_qty <= 0 or increase_qty <= 0:
        raise ValueError("Quantities must be greater than zero.")

    if decrease_product_id == increase_product_id:
        raise ValueError("Decrease and increase products must be different.")

    return decrease_product_id, decrease_qty, increase_product_id, increase_qty


def _create_conversion(db, batch: ConversionBatch, payload: dict) -> Conversion:
    decrease_product_id, decrease_qty, increase_product_id, increase_qty = (
        _validate_conversion_payload(payload)
    )

    decrease_product, decrease_quantity = _validate_and_get_product_with_quantity(db, decrease_product_id)
    increase_product, increase_quantity = _validate_and_get_product_with_quantity(db, increase_product_id)

    if decrease_quantity.on_hand < decrease_qty:
        raise InsufficientStockError(
            product_id=decrease_product_id,
            on_hand=decrease_quantity.on_hand,
            required=decrease_qty,
        )

    timestamp = datetime.now(timezone.utc)
    note = payload.get("note")

    consume_txn = Transaction(
        product_id=decrease_product.id,
        quantity_delta=-decrease_qty,
        reason=TransactionReason.ADJUSTMENT.value,
        note=note,
        state=TransactionState.COMMITTED.value,
        created_at=timestamp,
        order_id=batch.order_id,
    )
    produce_txn = Transaction(
        product_id=increase_product.id,
        quantity_delta=increase_qty,
        reason=TransactionReason.ADJUSTMENT.value,
        note=note,
        state=TransactionState.COMMITTED.value,
        created_at=timestamp,
        order_id=batch.order_id,
    )

    decrease_quantity.on_hand -= decrease_qty
    increase_quantity.on_hand += increase_qty

    db.add(consume_txn)
    db.add(produce_txn)
    db.flush()

    conversion = Conversion(
        batch_id=batch.id,
        decrease_txn_id=consume_txn.id,
        increase_txn_id=produce_txn.id,
        created_at=timestamp,
        state=ConversionState.COMPLETED.value,
        note=note,
    )
    batch.conversions.append(conversion)
    db.add(conversion)
    db.flush()
    return conversion


@conversion_bp.route("/conversion_batches", methods=["POST"])
def create_conversion_batch():
    db = g.db
    data = request.get_json() or {}

    conversions_payload = data.get("conversions") or []
    if not conversions_payload:
        return jsonify({"error": "At least one conversion is required."}), 400

    order_id = data.get("order_id")
    if order_id:
        order = db.get(Order, order_id)
        if not order:
            return jsonify({"error": "Order not found"}), 404

    batch = ConversionBatch(
        order_id=order_id,
        note=data.get("note"),
        created_by=data.get("created_by"),
    )
    db.add(batch)
    db.flush()

    try:
        conversions = [_create_conversion(db, batch, payload) for payload in conversions_payload]
        db.commit()
    except InsufficientStockError as e:
        db.rollback()
        return (
            jsonify(
                {
                    "error": "Not enough inventory to convert.",
                    "details": {
                        "product_id": e.product_id,
                        "on_hand": e.on_hand,
                        "required": e.required,
                    },
                }
            ),
            409,
        )
    except ValueError as e:
        db.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.rollback()
        current_app.logger.exception("Error creating conversion batch")
        return jsonify({"error": "Internal server error while creating conversion batch"}), 500

    return (
        jsonify(
            {
                "batch": _serialize_batch(batch),
                "conversions": [_serialize_conversion(conv) for conv in conversions],
            }
        ),
        201,
    )


@conversion_bp.route("/conversion_batches/search", methods=["GET"])
def search_conversion_batches():
    db = g.db
    try:
        page, limit = validate_pagination(
            request.args.get("page"), request.args.get("limit"), default_limit=25
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    offset = (page - 1) * limit

    filters = []
    order_id = request.args.get("order_id", type=int)
    created_by = request.args.get("created_by")
    query_str = request.args.get("q")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")

    if order_id:
        filters.append(ConversionBatch.order_id == order_id)
    if created_by:
        filters.append(ConversionBatch.created_by == created_by)
    if query_str:
        filters.append(ConversionBatch.note.ilike(f"%{query_str}%"))

    if date_from:
        try:
            filters.append(ConversionBatch.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            return jsonify({"error": "Invalid date_from format."}), 400
    if date_to:
        try:
            filters.append(ConversionBatch.created_at <= datetime.fromisoformat(date_to))
        except ValueError:
            return jsonify({"error": "Invalid date_to format."}), 400

    counts_subquery = (
        select(Conversion.batch_id, func.count(Conversion.id).label("conv_count"))
        .group_by(Conversion.batch_id)
        .subquery()
    )

    query = (
        select(ConversionBatch, counts_subquery.c.conv_count)
        .join(counts_subquery, ConversionBatch.id == counts_subquery.c.batch_id, isouter=True)
        .where(*filters)
        .order_by(ConversionBatch.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    results = db.execute(query).all()
    total = db.execute(
        select(func.count()).select_from(ConversionBatch).where(*filters)
    ).scalar()

    return (
        jsonify(
            {
                "page": page,
                "limit": limit,
                "total": total,
                "results": [
                    _serialize_batch(batch, conversions_total=count or 0) for batch, count in results
                ],
            }
        ),
        200,
    )


@conversion_bp.route("/conversion_batches/<int:batch_id>", methods=["GET"])
def get_conversion_batch(batch_id: int):
    db = g.db
    batch = db.get(ConversionBatch, batch_id)
    if not batch:
        return jsonify({"error": "Conversion batch not found"}), 404

    conversions = (
        db.execute(
            select(Conversion)
            .where(Conversion.batch_id == batch_id)
            .order_by(Conversion.created_at.asc())
        )
        .scalars()
        .all()
    )

    return (
        jsonify(
            {
                "batch": _serialize_batch(batch),
                "conversions": [_serialize_conversion(conv) for conv in conversions],
            }
        ),
        200,
    )


@conversion_bp.route("/conversion_batches/<int:batch_id>/conversions", methods=["POST"])
def add_conversion_to_batch(batch_id: int):
    db = g.db
    batch = db.get(ConversionBatch, batch_id)
    if not batch:
        return jsonify({"error": "Conversion batch not found"}), 404

    payload = request.get_json() or {}
    try:
        conversion = _create_conversion(db, batch, payload)
        db.commit()
    except InsufficientStockError as e:
        db.rollback()
        return (
            jsonify(
                {
                    "error": "Not enough inventory to convert.",
                    "details": {
                        "product_id": e.product_id,
                        "on_hand": e.on_hand,
                        "required": e.required,
                    },
                }
            ),
            409,
        )
    except ValueError as e:
        db.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.rollback()
        current_app.logger.exception("Error adding conversion to batch %s", batch_id)
        return jsonify({"error": "Internal server error while adding conversion"}), 500

    return jsonify({"conversion": _serialize_conversion(conversion)}), 201


@conversion_bp.route("/conversion_batches/<int:batch_id>", methods=["PATCH"])
def update_conversion_batch(batch_id: int):
    db = g.db
    data = request.get_json() or {}

    batch = db.get(ConversionBatch, batch_id)
    if not batch:
        return jsonify({"error": "Conversion batch not found"}), 404

    if "order_id" in data:
        new_order_id = data.get("order_id")
        if new_order_id is not None:
            order = db.get(Order, new_order_id)
            if not order:
                return jsonify({"error": "Order not found"}), 404
        batch.order_id = new_order_id

    if "note" in data:
        batch.note = data.get("note")

    db.commit()
    return jsonify({"batch": _serialize_batch(batch)}), 200


@conversion_bp.route("/conversions/<int:conversion_id>/rollback", methods=["PATCH"])
def rollback_conversion(conversion_id: int):
    db = g.db
    payload = request.get_json() or {}
    conversion = db.get(Conversion, conversion_id)

    if not conversion:
        return jsonify({"error": "Conversion not found"}), 404

    state = _derive_state(conversion)
    if state == "rolled_back":
        return jsonify({"error": "Conversion already rolled back"}), 400

    increase_txn = conversion.increase_txn
    qty_record = _get_product_quantity_from_transaction(increase_txn)
    required = abs(increase_txn.quantity_delta)

    if qty_record and qty_record.on_hand < required:
        return (
            jsonify(
                {
                    "error": "Cannot roll back conversion due to insufficient on_hand.",
                    "details": {
                        "product_id": increase_txn.product_id,
                        "on_hand": qty_record.on_hand,
                        "required": required,
                    },
                }
            ),
            409,
        )

    try:
        decrease_rb = conversion.decrease_txn.rollback(db)
        increase_rb = conversion.increase_txn.rollback(db)

        if payload.get("note"):
            decrease_rb.note = payload["note"]
            increase_rb.note = payload["note"]

        conversion.state = ConversionState.ROLLED_BACK.value
        db.commit()
    except ValueError as e:
        db.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception:
        db.rollback()
        current_app.logger.exception("Error rolling back conversion %s", conversion_id)
        return jsonify({"error": "Unexpected error while rolling back conversion"}), 500

    return (
        jsonify(
            {
                "message": "Conversion rolled back.",
                "conversion": {
                    "id": conversion.id,
                    "batch_id": conversion.batch_id,
                    "state": "rolled_back",
                    "rollback": {
                        "decrease_rollback_transaction_id": decrease_rb.id,
                        "increase_rollback_transaction_id": increase_rb.id,
                    },
                },
            }
        ),
        200,
    )


@conversion_bp.route("/conversion_batches/<int:batch_id>/rollback", methods=["PATCH"])
def rollback_conversion_batch(batch_id: int):
    db = g.db
    batch = db.get(ConversionBatch, batch_id)
    if not batch:
        return jsonify({"error": "Conversion batch not found"}), 404

    conversions = (
        db.execute(select(Conversion).where(Conversion.batch_id == batch_id)).scalars().all()
    )

    to_rollback = []
    skipped = []
    for conv in conversions:
        state = _derive_state(conv)
        if state == "rolled_back":
            skipped.append(conv.id)
            continue

        increase_txn = conv.increase_txn
        qty_record = _get_product_quantity_from_transaction(increase_txn)
        required = abs(increase_txn.quantity_delta)
        if qty_record and qty_record.on_hand < required:
            return (
                jsonify(
                    {
                        "error": "Cannot roll back conversion due to insufficient on_hand.",
                        "details": {
                            "product_id": increase_txn.product_id,
                            "on_hand": qty_record.on_hand,
                            "required": required,
                        },
                    }
                ),
                409,
            )

        to_rollback.append(conv)

    rolled_back_ids = []
    try:
        for conv in to_rollback:
            conv.decrease_txn.rollback(db)
            conv.increase_txn.rollback(db)
            conv.state = ConversionState.ROLLED_BACK.value
            rolled_back_ids.append(conv.id)
        db.commit()
    except Exception as e:
        db.rollback()
        current_app.logger.exception("Error rolling back conversion batch %s", batch_id)
        return jsonify({"error": "Internal server error while rolling back conversion batch"}), 500

    return (
        jsonify(
            {
                "message": "Batch rolled back.",
                "batch_id": batch_id,
                "results": {"rolled_back": rolled_back_ids, "skipped": skipped},
            }
        ),
        200,
    )


@conversion_bp.route("/conversions/search", methods=["GET"])
def search_conversions():
    db = g.db
    try:
        page, limit = validate_pagination(
            request.args.get("page"), request.args.get("limit"), default_limit=25
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    offset = (page - 1) * limit

    filters = []
    batch_id = request.args.get("batch_id", type=int)
    order_id = request.args.get("order_id", type=int)
    product_id = request.args.get("product_id", type=int)

    if batch_id:
        filters.append(Conversion.batch_id == batch_id)

    if order_id:
        filters.append(Conversion.batch.has(ConversionBatch.order_id == order_id))

    if product_id:
        filters.append(
            or_(
                Conversion.decrease_txn.has(Transaction.product_id == product_id),
                Conversion.increase_txn.has(Transaction.product_id == product_id),
            )
        )

    conversions = (
        db.execute(
            select(Conversion)
            .where(*filters)
            .order_by(Conversion.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        .scalars()
        .all()
    )

    total = db.execute(select(func.count()).select_from(Conversion).where(*filters)).scalar()

    return (
        jsonify(
            {
                "page": page,
                "limit": limit,
                "total": total,
                "results": [
                    {**_serialize_conversion(conv), "order_id": conv.batch.order_id if conv.batch else None}
                    for conv in conversions
                ],
            }
        ),
        200,
    )
