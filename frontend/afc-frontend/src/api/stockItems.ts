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

export interface StockItemCategory {
  id: number;
  name: string;
}

export interface CreateStockItemPayload {
  name: string;
  supplier_id: number;
  category_id: number;
  description?: string | null;
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

export function fetchStockItemCategories(): Promise<StockItemCategory[]> {
  return apiRequest("/stock_item_categories") as Promise<StockItemCategory[]>;
}

export function patchStockItem(
  id: string | number,
  data: { supplier_id?: number; category_id?: number }
) {
  return apiRequest(`/stock_items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function createStockItem(data: CreateStockItemPayload): Promise<{
  message: string;
  stock_item: { id: number; name: string };
  product_id: number;
  quantity_id: number;
}> {
  return apiRequest("/stock_items", {
    method: "POST",
    body: JSON.stringify(data),
  }) as Promise<{
    message: string;
    stock_item: { id: number; name: string };
    product_id: number;
    quantity_id: number;
  }>;
}
