from marshmallow import Schema, fields, validate

class OrderSchema(Schema):
    id = fields.Int(dump_only=True)
    qb_id = fields.Str(allow_none=True)
    order_number = fields.Str(required=True, validate=validate.Length(min=1))
    customer = fields.Str(allow_none=True)
    description = fields.Str(allow_none=True)
    
    type = fields.Str(
        required=True,
        validate=validate.OneOf(["qb_packing_slip", "internal", "adjustment"])
    )

    status = fields.Str(
        required=True,
        validate=validate.OneOf(["pending", "completed", "voided"])
    )

    created_at = fields.DateTime(dump_only=True)
