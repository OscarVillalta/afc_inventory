from marshmallow import Schema, fields, validate

class TransactionSchema(Schema):
    id = fields.Int(dump_only=True)
    product_id = fields.Int(required=True)
    order_id = fields.Int(load_default=None)
    order_item_id = fields.Int(load_default=None)
    quantity_delta = fields.Int(required=True)  # signed integer (+in, -out)

    reason = fields.Str(
        required=True,
        validate=validate.OneOf([e.value for e in TransactionReason])
    )

    state = fields.Str(
        load_default=TransactionState.PENDING.value,
        validate=validate.OneOf([e.value for e in TransactionState])
    )
    
    note = fields.Str(load_default=None)
    created_at = fields.DateTime(dump_only=True)

