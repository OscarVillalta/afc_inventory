import { apiRequest } from "./apiClient";

/* ============================================================
   TYPES — match /stock_items/search
============================================================ */

export interface StockItemPayload {
  id: number;
  product_id: number;
  child_product_id?: number | null;
  parent_product_id?: number | null;
  name: string;
  description: string | null;
  supplier_name: string;
  category_name: string;

  on_hand: number;
  reserved: number;
  ordered: number;
  location: number;
  available: number;
  backordered: number;
}

export interface StockItemResponse {
  page: number;
  limit: number;
  count: number;
  total: number;
  results: StockItemPayload[];
}

/* ============================================================
   SEARCH PARAMS
============================================================ */

export interface StockItemSearchParams {
  name?: string;
  description?: string;
  supplier?: string;
  category?: string;
}

/* ============================================================
   API FUNCTIONS
============================================================ */

/**
 * Server-side filtered + paginated stock item search
 */
export function fetchStockItems(
  page = 1,
  limit = 10,
  filters: StockItemSearchParams = {}
): Promise<StockItemResponse> {
  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("limit", String(limit));

  if (filters.name) params.set("name", filters.name);
  if (filters.description) params.set("description", filters.description);
  if (filters.supplier) params.set("supplier", filters.supplier);
  if (filters.category) params.set("category", filters.category);

  return apiRequest(`/stock_items/search?${params.toString()}`, {
    method: "GET",
  });
}
