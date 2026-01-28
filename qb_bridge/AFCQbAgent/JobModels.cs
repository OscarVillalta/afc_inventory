using System;
using System.Collections.Generic;

namespace AfcQbAgent;

public sealed class JobDto
{
    // A client-provided id (so Flask can correlate responses)
    public string JobId { get; set; } = Guid.NewGuid().ToString("N");

    // Operation type:
    // "query" | "create" (or "add")
    public string Op { get; set; } = "";

    // Target entity:
    // "inventory" | "estimate" | "sales_order" | etc
    public string Entity { get; set; } = "";

    // Optional parameters (usually for queries)
    // ex: { "refnumber": "1234" } or { "txnid": "..." }
    public Dictionary<string, object> Params { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    // Optional payload (usually for creates/adds)
    // ex: sales order header + line items
    public Dictionary<string, object>? Payload { get; set; }

    // Optional: explicitly force a company file path if you want
    // (otherwise QbSdk can use its configured/default behavior)
    public string? CompanyFilePath { get; set; }

    // Optional: allow toggling includeLineItems or similar flags per job
    // (you can ignore for now if you don't want it)
    public Dictionary<string, object>? Options { get; set; }
}

public sealed class JobResultDto
{
    public string JobId { get; set; } = "";

    // True if SDK call succeeded and we got QBXML back
    public bool Success { get; set; }

    // The raw QBXML request we sent (handy for debugging; optional)
    public string? QbxmlRequest { get; set; }

    // The raw QBXML response (this is what you’ll send back to Flask)
    public string? QbxmlResponse { get; set; }

    // Error info if Success=false
    public string? ErrorCode { get; set; }     // e.g. "QBSDK_COM_0x80040418"
    public string? ErrorMessage { get; set; }  // human readable
    public string? ExceptionType { get; set; } // e.g. "COMException"
    public string? StackTrace { get; set; }    // optional
}
