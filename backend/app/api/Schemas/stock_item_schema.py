from marshmallow import Schema, fields

class StockItemSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    description = fields.Str(required=False)
    supplier_id = fields.Int(required=True)
    category_id = fields.Int(required=True)
