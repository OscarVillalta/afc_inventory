from marshmallow import Schema, fields, validate

class AirFilterSchema(Schema):
    id = fields.Int(dump_only=True)
    part_number = fields.Str(required=True, validate=validate.Length(min=1))
    supplier_id = fields.Int(required=True)
    category_id = fields.Int(required=True)
    merv_rating = fields.Int(load_default=0, validate=validate.Range(min=0, max=18))
    height = fields.Int(load_default=0)
    width = fields.Int(load_default=0)
    depth = fields.Int(load_default=0)
    location = fields.Str(load_default="Warehouse A")
