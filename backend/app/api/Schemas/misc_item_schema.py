from marshmallow import Schema, fields, validate

class MiscItemSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    supplier_id = fields.Int(required=True)
    description = fields.Str(required=False)
    parent_product_id = fields.Int(allow_none=True, load_default=None)
  