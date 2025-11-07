from marshmallow import Schema, fields, validate

class TransactionSchema(Schema):
    id = fields.Int(dump_only=True)
    filter_id = fields.Int(required=True)
    order_id = fields.Int(allow_none=True)

    # MUST be positive or negative, not zero
    quantity = fields.Int(
        required=True,
        validate=validate.Range(min=-10_000, max=10_000, min_inclusive=False)
    )

    reason = fields.Str(
        required=True,
        validate=validate.OneOf([
            "ship",
            "receive",
            "manual_adjust",
            "count_correction",
            "return",
            "scrap"
        ])
    )

    note = fields.Str(required=False, load_default=None, allow_none=True)
    created_at = fields.DateTime(dump_only=True)
