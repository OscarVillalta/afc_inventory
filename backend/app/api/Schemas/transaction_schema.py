from marshmallow import Schema, fields, validate

class TransactionSchema(Schema):
    id = fields.Int(dump_only=True)
    product_id = fields.Int(required=True)
    order_id = fields.Int(load_default=None)
    order_item_id = fields.Int(load_default=None)
    quantity_delta = fields.Int(required=True)  # signed integer (+in, -out)
    reason = fields.Str(load_default="Unknown")
    state = fields.Str(load_default="pending", validate=lambda x: x in ["pending", "committed", "cancelled"])
    note = fields.Str(load_default=None)
    created_at = fields.DateTime(dump_only=True)

