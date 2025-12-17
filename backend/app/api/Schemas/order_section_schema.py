from marshmallow import Schema, fields, validate
from database.models import OrderStatus

class OrderSectionSchema(Schema):
    id = fields.Int(dump_only=True)
    order_id = fields.Int(required=True)
    description = fields.Str(load_default=" ")
    title = fields.Str(allow_none=True)
    sort_order = fields.Int(allow_none=True)

    status = fields.Str(
        dump_only=True,
        validate=validate.OneOf([e.value for e in OrderStatus])
    )

    created_at = fields.DateTime(dump_only=True)
