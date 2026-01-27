from marshmallow import Schema, fields

class OrderItemSchema(Schema):
    id = fields.Int(dump_only=True)
    order_id = fields.Int(required=True)
    product_id = fields.Int(required=True)
    quantity_ordered = fields.Int(required=True)
    quantity_fulfilled = fields.Int(dump_only=True)
    note = fields.Str(allow_none=True)
