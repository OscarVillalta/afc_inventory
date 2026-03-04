from marshmallow import Schema, fields

class OrderSchema(Schema):
    id = fields.Int(dump_only=True)
    order_number = fields.Str(required=True)
    type = fields.Str(required=True)
    supplier_id = fields.Int(allow_none=True)
    customer_id = fields.Int(allow_none=True)
    status = fields.Str()
    description = fields.Str(allow_none=True)
    created_at = fields.DateTime(dump_only=True)
