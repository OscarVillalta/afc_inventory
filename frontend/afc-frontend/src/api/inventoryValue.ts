import { readAccessToken } from "./auth";
import { ApiError, apiRequest } from "./apiClient";

export interface InventoryValueGroup {
  supplier_id: number | null;
  supplier_name: string | null;
  product_id: number | null;
  product_name: string | null;
  unit_price: number | null;
  on_hand_units: number;
  sku_count: number;
  gross_total: number;
}

export interface InventoryValue {
  restricted: boolean;
  gross_total: number | null;
  on_hand_units: number | null;
  sku_count: number | null;
  unpriced_skus: number | null;
  groups: InventoryValueGroup[];
  groups_truncated: boolean;
}

export interface InventoryValueQuery {
  supplierId?: number | null;
  productId?: number | null;
  groupBy?: "supplier" | "product" | null;
  q?: string | null;
  limit?: number;
}

function finiteNumber(value: unknown, fallback: number | null): number | null {
  if (value == null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function optionalId(value: unknown): number | null {
  const n = finiteNumber(value, null);
  if (n == null || !Number.isInteger(n) || n < 1) return null;
  return n;
}

function normalizeGroup(raw: unknown): InventoryValueGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const gross = finiteNumber(row.gross_total, null);
  if (gross == null) return null;
  return {
    supplier_id: optionalId(row.supplier_id),
    supplier_name: typeof row.supplier_name === "string" && row.supplier_name ? row.supplier_name : null,
    product_id: optionalId(row.product_id),
    product_name: typeof row.product_name === "string" && row.product_name ? row.product_name : null,
    unit_price: finiteNumber(row.unit_price, null),
    on_hand_units: finiteNumber(row.on_hand_units, 0) ?? 0,
    sku_count: finiteNumber(row.sku_count, 0) ?? 0,
    gross_total: gross,
  };
}

export function normalizeInventoryValue(raw: unknown): InventoryValue {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const restricted = src.restricted === true;
  const groups = Array.isArray(src.groups)
    ? src.groups.map(normalizeGroup).filter((group): group is InventoryValueGroup => group !== null)
    : [];
  return {
    restricted,
    gross_total: restricted ? null : finiteNumber(src.gross_total, 0),
    on_hand_units: restricted ? null : finiteNumber(src.on_hand_units, 0),
    sku_count: restricted ? null : finiteNumber(src.sku_count, 0),
    unpriced_skus: restricted ? null : finiteNumber(src.unpriced_skus, 0),
    groups,
    groups_truncated: src.groups_truncated === true,
  };
}

export function formatInventoryMoney(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  try {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function appendId(params: URLSearchParams, key: string, value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) return;
  params.set(key, String(value));
}

export function fetchInventoryValue(query: InventoryValueQuery = {}): Promise<InventoryValue> {
  const params = new URLSearchParams();
  appendId(params, "supplier_id", query.supplierId);
  appendId(params, "product_id", query.productId);
  if (query.groupBy === "supplier" || query.groupBy === "product") {
    params.set("group_by", query.groupBy);
    if (typeof query.limit === "number" && Number.isInteger(query.limit)) {
      params.set("limit", String(Math.min(200, Math.max(1, query.limit))));
    }
  }
  const q = (query.q ?? "").trim().slice(0, 80);
  if (q) params.set("q", q);
  const qs = params.toString();
  const token = readAccessToken();
  return apiRequest(`/inventory/value${qs ? `?${qs}` : ""}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then((body) => {
    const value = normalizeInventoryValue(body);
    if (value.restricted) {
      throw new ApiError(403, "Forbidden");
    }
    return value;
  });
}
