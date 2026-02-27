using System;
using System.Collections.Generic;

namespace AfcQbAgent;

public sealed class QbxmlBuilder
{
    private static readonly HashSet<string> AllowedOps =
        new(StringComparer.OrdinalIgnoreCase) { "query" };

    private static readonly HashSet<string> AllowedEntities =
        new(StringComparer.OrdinalIgnoreCase) { "inventory", "iteminventory", "estimate", "sales_order", "salesorder", "invoice", "purchase_order", "purchaseorder" };

    private static string Norm(string? s) => (s ?? "").Trim().ToLowerInvariant();

    public string Build(JobDto job)
    {
        if (job == null) throw new ArgumentNullException(nameof(job));

        var op = Norm(job.Op);
        var entity = Norm(job.Entity);


        // Strict allowlist so Flask gets predictable errors
        if (!AllowedOps.Contains(op))
            throw new ArgumentException($"Unsupported op '{job.Op}'. Allowed: query.");

        if (!AllowedEntities.Contains(entity))
            throw new ArgumentException($"Unsupported entity '{job.Entity}'. Allowed: inventory, estimate, sales_order, invoice, purchase_order.");

        // --- Queries ---
        if (op == "ping" && (entity == "quickbooks" || entity == "qb"))
            return WrapRq(@"<CompanyQueryRq/>");

        if (op == "query" && entity is "inventory" or "iteminventory")
            return BuildItemInventoryQuery(job);

        if (op == "query" && entity == "estimate")
            return BuildEstimateQuery(job);

        if (op == "query" && (entity == "sales_order" || entity == "salesorder"))
            return BuildSalesOrderQuery(job);

        if (op == "query" && (entity == "purchase_order" || entity == "purchaseorder"))
            return BuildPurchaseOrderQuery(job);

        // Keep the existing invoice support
        if (op == "query" && entity == "invoice")
            return BuildInvoiceQuery(job);

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
    // 4) PullPurchaseOrder -> PurchaseOrderQueryRq
    // ------------------------------------------------------------
    private static string BuildPurchaseOrderQuery(JobDto job)
    {
        // Accept either params.txnid OR params.refnumber (exactly one)
        var txnId = GetParamString(job, "txnid");
        var refNumber = GetParamString(job, "refnumber");

        if (!string.IsNullOrWhiteSpace(txnId) && !string.IsNullOrWhiteSpace(refNumber))
            throw new ArgumentException("Provide only one: params.txnid OR params.refnumber (not both).");

        if (string.IsNullOrWhiteSpace(txnId) && string.IsNullOrWhiteSpace(refNumber))
            throw new ArgumentException("PurchaseOrder query requires params.txnid OR params.refnumber");

        var core = !string.IsNullOrWhiteSpace(txnId)
            ? $@"
    <PurchaseOrderQueryRq>
      <TxnID>{EscapeXml(txnId!)}</TxnID>
      <IncludeLineItems>true</IncludeLineItems>
    </PurchaseOrderQueryRq>"
            : $@"
    <PurchaseOrderQueryRq>
      <RefNumber>{EscapeXml(refNumber!)}</RefNumber>
      <IncludeLineItems>true</IncludeLineItems>
    </PurchaseOrderQueryRq>";

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

    private static string EscapeXml(string s) =>
        (s ?? "")
            .Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;")
            .Replace("\"", "&quot;").Replace("'", "&apos;");
}
