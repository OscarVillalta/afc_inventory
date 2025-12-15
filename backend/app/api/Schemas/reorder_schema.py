from marshmallow import Schema, fields, validate

# -----------------------------
# Generic ID + sort_order pair
# -----------------------------
class SortOrderItemSchema(Schema):
    id = fields.Int(required=True)
    sort_order = fields.Int(required=True)


# -----------------------------
# Reorder Sections
# -----------------------------
class ReorderSectionsSchema(Schema):
    sections = fields.List(
        fields.Nested(SortOrderItemSchema),
        required=True,
        validate=validate.Length(min=1)
    )


# -----------------------------
# Reorder Items in Section
# -----------------------------
class ReorderItemsSchema(Schema):
    items = fields.List(
        fields.Nested(SortOrderItemSchema),
        required=True,
        validate=validate.Length(min=1)
    )


# -----------------------------
# Move Item Between Sections
# -----------------------------
class MoveOrderItemSchema(Schema):
    to_section_id = fields.Int(required=True)
    sort_order = fields.Int(required=True)
