from marshmallow import Schema, fields

class BlockedItemSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
