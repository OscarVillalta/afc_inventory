from marshmallow import Schema, fields, validate

class ChildProductSchema(Schema):
    id = fields.Int(dump_only=True)
    category_id = fields.Int(required=True)
    reference_id = fields.Int(required=True)
    parent_product_id = fields.Int(required=True)
    is_active = fields.Bool(load_default=True)
