from marshmallow import Schema, fields, validate

class ProductSchema(Schema):
    id = fields.Int(dump_only=True)
    category_id = fields.Int(required=True)
    reference_id = fields.Int(required=True)
    parent_product_id = fields.Int(allow_none=True, load_default=None)