from marshmallow import Schema, fields, validate, EXCLUDE


class QBJobSchema(Schema):
    class Meta:
        unknown = EXCLUDE  # ignore extra keys safely

    jobId = fields.Str(required=False, allow_none=True)

    op = fields.Str(
        required=True,
        validate=validate.OneOf(["query", "ping"])
    )

    entity = fields.Str(
        required=True,
        validate=validate.OneOf([
            "inventory",
            "iteminventory",
            "estimate",
            "sales_order",
            "salesorder",
            "invoice",
            "purchase_order",
            "purchaseorder",
            "agent",
            "quickbooks",
            "qb",
        ])
    )

    params = fields.Dict(
        keys=fields.Str(),
        values=fields.Raw(),
        required=False,
        allow_none=True,
        load_default=dict,
    )

    companyFilePath = fields.Str(required=False, allow_none=True)

    options = fields.Dict(
        keys=fields.Str(),
        values=fields.Raw(),
        required=False,
        allow_none=True,
    )

class QBJobResultSchema(Schema):
    jobId = fields.Str(required=True)

    success = fields.Bool(required=True)

    qbxmlRequest = fields.Str(required=False, allow_none=True)
    qbxmlResponse = fields.Str(required=False, allow_none=True)

    errorCode = fields.Str(required=False, allow_none=True)
    errorMessage = fields.Str(required=False, allow_none=True)
    exceptionType = fields.Str(required=False, allow_none=True)
    stackTrace = fields.Str(required=False, allow_none=True)

