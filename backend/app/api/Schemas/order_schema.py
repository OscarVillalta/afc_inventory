from marshmallow import Schema, fields, validate
from database.models import OrderStatus, OrderType

class OrderSchema(Schema):
    id = fields.Int(dump_only=True)
    order_number = fields.Str(required=True, validate=validate.Length(min=1))
    customer_id = fields.Int(allow_none=True)
    supplier_id = fields.Int(allow_none=True)
    description = fields.Str(allow_none=True)

    
    type = fields.Str(
        required=True,
        validate=validate.OneOf([e.value for e in OrderType])
    )

    status = fields.Str(
        dump_only=True,
        validate=validate.OneOf([e.value for e in OrderStatus])
    )

    created_at = fields.DateTime(dump_only=True)
    completed_at = fields.DateTime(allow_none=True)
