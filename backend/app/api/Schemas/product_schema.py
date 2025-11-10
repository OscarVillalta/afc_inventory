from marshmallow import Schema, fields, validate

class ProductSchema(Schema):
    id = fields.Int(dump_only=True)
    category_id = fields.Int(required=True)
    reference_id = fields.Int(required=True)