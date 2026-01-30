using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;

namespace AfcQbAgent;

public sealed class QbxmlBuilder
{
    private static readonly HashSet<string> AllowedOps =
        new(StringComparer.OrdinalIgnoreCase) { "query", "create", "add" };

    private static readonly HashSet<string> AllowedEntities =
        new(StringComparer.OrdinalIgnoreCase) { "inventory", "iteminventory", "estimate", "sales_order", "salesorder", "invoice" };

    private static string Norm(string? s) => (s ?? "").Trim().ToLowerInvariant();

    public string Build(JobDto job)
    {
        if (job == null) throw new ArgumentNullException(nameof(job));

        var op = Norm(job.Op);
        var entity = Norm(job.Entity);


        // Strict allowlist so Flask gets predictable errors
        if (!AllowedOps.Contains(op))
            throw new ArgumentException($"Unsupported op '{job.Op}'. Allowed: query, create, add.");

        if (!AllowedEntities.Contains(entity))
            throw new ArgumentException($"Unsupported entity '{job.Entity}'. Allowed: inventory, estimate, sales_order, invoice.");

        // --- Queries ---
        if (op == "ping" && (entity == "quickbooks" || entity == "qb"))
            return WrapRq(@"<CompanyQueryRq/>");

        if (op == "query" && entity is "inventory" or "iteminventory")
            return BuildItemInventoryQuery(job);

        if (op == "query" && entity == "estimate")
            return BuildEstimateQuery(job);

        if (op == "query" && (entity == "sales_order" || entity == "salesorder"))
            return BuildSalesOrderQuery(job);

        // keep your existing invoice support
        if (op == "query" && entity == "invoice")
            return BuildInvoiceQuery(job);

        // --- Creates ---
        if ((op == "create" || op == "add") && (entity == "sales_order" || entity == "salesorder"))
            return BuildSalesOrderAdd(job);

        // --- Health / Ping ---
        if (op == "ping" && (entity == "quickbooks" || entity == "qb"))
            return BuildCompanyQueryPing();


        // Should not hit due to allowlist, but keep as a safety net
        throw new NotSupportedException($"Unsupported job op/entity: {job.Op}/{job.Entity}");
    }

    // ------------------------------------------------------------
    // 1) QueryInventory -> ItemInventoryQueryRq
    // ------------------------------------------------------------
    private static string BuildItemInventoryQuery(JobDto job)
    {
        // Optional params: active_status = "All"|"ActiveOnly"|"InactiveOnly"
        var activeStatus = GetParamString(job, "active_status") ?? "All";

        if (!IsOneOf(activeStatus, "All", "ActiveOnly", "InactiveOnly"))
            throw new ArgumentException("params.active_status must be one of: All, ActiveOnly, InactiveOnly");

        return WrapRq($@"
    <ItemInventoryQueryRq>
      <ActiveStatus>{EscapeXml(activeStatus)}</ActiveStatus>
    </ItemInventoryQueryRq>");
    }

    // ------------------------------------------------------------
    // 2) PullEstimate -> EstimateQueryRq
    // ------------------------------------------------------------
    private static string BuildEstimateQuery(JobDto job)
    {
        // Accept either params.txnid OR params.refnumber (exactly one)
        var txnId = GetParamString(job, "txnid");
        var refNumber = GetParamString(job, "refnumber");

        if (!string.IsNullOrWhiteSpace(txnId) && !string.IsNullOrWhiteSpace(refNumber))
            throw new ArgumentException("Provide only one: params.txnid OR params.refnumber (not both).");

        if (string.IsNullOrWhiteSpace(txnId) && string.IsNullOrWhiteSpace(refNumber))
            throw new ArgumentException("Estimate query requires params.txnid OR params.refnumber");

        var core = !string.IsNullOrWhiteSpace(txnId)
            ? $@"
    <EstimateQueryRq>
      <TxnID>{EscapeXml(txnId!)}</TxnID>
      <IncludeLineItems>true</IncludeLineItems>
    </EstimateQueryRq>"
            : $@"
    <EstimateQueryRq>
      <RefNumber>{EscapeXml(refNumber!)}</RefNumber>
      <IncludeLineItems>true</IncludeLineItems>
    </EstimateQueryRq>";

        return WrapRq(core);
    }

    // ------------------------------------------------------------
    // 3) PullSalesOrder -> SalesOrderQueryRq
    // ------------------------------------------------------------
    private static string BuildSalesOrderQuery(JobDto job)
    {
        // Accept either params.txnid OR params.refnumber (exactly one)
        var txnId = GetParamString(job, "txnid");
        var refNumber = GetParamString(job, "refnumber");

        if (!string.IsNullOrWhiteSpace(txnId) && !string.IsNullOrWhiteSpace(refNumber))
            throw new ArgumentException("Provide only one: params.txnid OR params.refnumber (not both).");

        if (string.IsNullOrWhiteSpace(txnId) && string.IsNullOrWhiteSpace(refNumber))
            throw new ArgumentException("SalesOrder query requires params.txnid OR params.refnumber");

        var core = !string.IsNullOrWhiteSpace(txnId)
            ? $@"
    <SalesOrderQueryRq>
      <TxnID>{EscapeXml(txnId!)}</TxnID>
      <IncludeLineItems>true</IncludeLineItems>
    </SalesOrderQueryRq>"
            : $@"
    <SalesOrderQueryRq>
      <RefNumber>{EscapeXml(refNumber!)}</RefNumber>
      <IncludeLineItems>true</IncludeLineItems>
    </SalesOrderQueryRq>";

        return WrapRq(core);
    }

    // ------------------------------------------------------------
    // 4) PushSalesOrder -> SalesOrderAddRq
    // ------------------------------------------------------------
    private static string BuildSalesOrderAdd(JobDto job)
    {
        if (job.Payload == null)
            throw new ArgumentException("PushSalesOrder requires payload");

        // Required
        var customerFullName = GetPayloadString(job, "customer_full_name");
        if (string.IsNullOrWhiteSpace(customerFullName))
            throw new ArgumentException("payload.customer_full_name is required");

        // Optional
        var refNumber = GetPayloadString(job, "refnumber");
        var txnDateIso = GetPayloadString(job, "txn_date"); // "YYYY-MM-DD" or ISO
        var memo = GetPayloadString(job, "memo");
        var poNumber = GetPayloadString(job, "po_number");

        // Items (required)
        var items = GetPayloadList(job, "items");
        if (items.Count == 0)
            throw new ArgumentException("payload.items must be a non-empty array");

        var headerXml = $@"
      <CustomerRef><FullName>{EscapeXml(customerFullName!)}</FullName></CustomerRef>
{(string.IsNullOrWhiteSpace(refNumber) ? "" : $"      <RefNumber>{EscapeXml(refNumber!)}</RefNumber>\n")}
{(string.IsNullOrWhiteSpace(txnDateIso) ? "" : $"      <TxnDate>{EscapeXml(NormalizeDateStrict(txnDateIso!))}</TxnDate>\n")}
{(string.IsNullOrWhiteSpace(poNumber) ? "" : $"      <PONumber>{EscapeXml(poNumber!)}</PONumber>\n")}
{(string.IsNullOrWhiteSpace(memo) ? "" : $"      <Memo>{EscapeXml(memo!)}</Memo>\n")}";

        var linesXml = "";
        foreach (var raw in items)
        {
            var dict = AsDict(raw);

            var itemName = GetString(dict, "item_full_name") ?? GetString(dict, "item");
            if (string.IsNullOrWhiteSpace(itemName))
                throw new ArgumentException("Each payload.items element must include item_full_name (or item).");

            var desc = GetString(dict, "desc") ?? GetString(dict, "description");

            var qty = GetDecimal(dict, "quantity") ?? 0m;
            if (qty <= 0)
                throw new ArgumentException("Each payload.items element must include quantity > 0.");

            // Either Rate or Amount (or neither), but not both
            var rate = GetDecimal(dict, "rate");
            var amount = GetDecimal(dict, "amount");
            if (rate.HasValue && amount.HasValue)
                throw new ArgumentException("Each payload.items element must include only one of: rate OR amount (not both).");

            var classFullName = GetString(dict, "class_full_name");
            var customerMsg = GetString(dict, "customer_msg");

            linesXml += $@"
      <SalesOrderLineAdd>
        <ItemRef><FullName>{EscapeXml(itemName!)}</FullName></ItemRef>
{(string.IsNullOrWhiteSpace(desc) ? "" : $"        <Desc>{EscapeXml(desc!)}</Desc>\n")}
        <Quantity>{FormatDecimal(qty)}</Quantity>
{(rate.HasValue ? $"        <Rate>{FormatDecimal(rate.Value)}</Rate>\n" : "")}
{(!rate.HasValue && amount.HasValue ? $"        <Amount>{FormatDecimal(amount.Value)}</Amount>\n" : "")}
{(string.IsNullOrWhiteSpace(classFullName) ? "" : $"        <ClassRef><FullName>{EscapeXml(classFullName!)}</FullName></ClassRef>\n")}
{(string.IsNullOrWhiteSpace(customerMsg) ? "" : $"        <CustomerMsgRef><FullName>{EscapeXml(customerMsg!)}</FullName></CustomerMsgRef>\n")}
      </SalesOrderLineAdd>";
        }

        var core = $@"
    <SalesOrderAddRq>
      <SalesOrderAdd>
{headerXml}
{linesXml}
      </SalesOrderAdd>
    </SalesOrderAddRq>";

        return WrapRq(core);
    }

    // ------------------------------------------------------------
    // Existing Invoice builder (kept)
    // ------------------------------------------------------------
    private static string BuildInvoiceQuery(JobDto job)
    {
        var refNumber = GetParamString(job, "refnumber");
        if (string.IsNullOrWhiteSpace(refNumber))
            throw new ArgumentException("Invoice query requires params.refnumber");

        return WrapRq($@"
    <InvoiceQueryRq>
      <RefNumber>{EscapeXml(refNumber!)}</RefNumber>
      <IncludeLineItems>true</IncludeLineItems>
    </InvoiceQueryRq>");
    }

    private static string BuildCompanyQueryPing()
    {
        // Lightest reliable request: CompanyQuery (no line items, small response)
        return WrapRq(@"
    <CompanyQueryRq/>
    ");
     }


    // ------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------
    private static bool IsOneOf(string value, params string[] allowed)
    {
        foreach (var a in allowed)
            if (string.Equals(value, a, StringComparison.OrdinalIgnoreCase))
                return true;
        return false;
    }

    private static string WrapRq(string innerRqXml)
    {
        // Use the QBXML version you’ve been using successfully
        return $@"<?xml version=""1.0"" encoding=""utf-8""?>
<?qbxml version=""13.0""?>
<QBXML>
  <QBXMLMsgsRq onError=""stopOnError"">{innerRqXml}
  </QBXMLMsgsRq>
</QBXML>";
    }

    private static string? GetParamString(JobDto job, string key)
    {
        if (job.Params == null) return null;
        if (!job.Params.TryGetValue(key, out var obj)) return null;

        obj = JsonElementExtensions.NormalizeUnknown(obj);
        return Convert.ToString(obj)?.Trim();
    }

    private static string? GetPayloadString(JobDto job, string key)
    {
        if (job.Payload == null) return null;
        if (!job.Payload.TryGetValue(key, out var obj)) return null;

        obj = JsonElementExtensions.NormalizeUnknown(obj);
        return Convert.ToString(obj)?.Trim();
    }

    private static List<object> GetPayloadList(JobDto job, string key)
    {
        if (job.Payload == null) return new List<object>();
        if (!job.Payload.TryGetValue(key, out var obj) || obj == null) return new List<object>();

        obj = JsonElementExtensions.NormalizeUnknown(obj);

        if (obj is List<object> lo) return lo;

        if (obj is List<object?> lo2)
        {
            var outList = new List<object>();
            foreach (var x in lo2) if (x != null) outList.Add(x);
            return outList;
        }

        if (obj is object[] arr) return new List<object>(arr);

        throw new ArgumentException($"payload.{key} must be an array");
    }

    private static Dictionary<string, object> AsDict(object raw)
    {
        // Normalize JsonElement -> Dictionary<string, object?>
        var dictAny = JsonElementExtensions.NormalizeToDict(raw);

        var dict = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        foreach (var kv in dictAny)
        {
            if (kv.Value != null)
                dict[kv.Key] = kv.Value!;
        }
        return dict;
    }

    private static string? GetString(Dictionary<string, object> d, string key)
    {
        if (!d.TryGetValue(key, out var obj) || obj == null) return null;
        return Convert.ToString(obj)?.Trim();
    }

    private static decimal? GetDecimal(Dictionary<string, object> d, string key)
    {
        if (!d.TryGetValue(key, out var obj) || obj == null) return null;

        obj = JsonElementExtensions.NormalizeUnknown(obj);

        if (obj is decimal dec) return dec;
        if (obj is double dbl) return (decimal)dbl;
        if (obj is float fl) return (decimal)fl;
        if (obj is int i) return i;
        if (obj is long l) return l;

        var s = Convert.ToString(obj);
        if (decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var v))
            return v;

        return null;
    }

    private static string NormalizeDateStrict(string isoOrDate)
    {
        // QB expects YYYY-MM-DD
        // If they pass full ISO (YYYY-MM-DDTHH:mm:ss), take date part.
        var s = (isoOrDate ?? "").Trim();
        if (string.IsNullOrWhiteSpace(s))
            throw new ArgumentException("payload.txn_date must be non-empty if provided.");

        var tIndex = s.IndexOf('T');
        if (tIndex > 0) s = s.Substring(0, tIndex);

        if (!DateTime.TryParseExact(
                s,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out _))
        {
            throw new ArgumentException("payload.txn_date must be YYYY-MM-DD (or ISO with a date prefix).");
        }

        return s;
    }

    private static string FormatDecimal(decimal v) =>
        v.ToString("0.####", CultureInfo.InvariantCulture);

    private static string EscapeXml(string s) =>
        (s ?? "")
            .Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;")
            .Replace("\"", "&quot;").Replace("'", "&apos;");
}
