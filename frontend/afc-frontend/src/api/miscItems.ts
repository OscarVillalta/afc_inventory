import { apiRequest } from "./apiClient";

/* ============================================================
   TYPES — match /misc_items/search
============================================================ */

export interface MiscItemPayload {
  id: number;
  product_id: number;
  name: string;
  description: string | null;
  supplier_name: string;

  on_hand: number;
  reserved: number;
  ordered: number;
  available: number;
  backordered: number;
}

export interface MiscItemResponse {
  page: number;
  limit: number;
  count: number;
  total: number;
  results: MiscItemPayload[];
}

/* ============================================================
   SEARCH PARAMS
============================================================ */

export interface MiscItemSearchParams {
  name?: string;
  description?: string;
  supplier?: string;
}

/* ============================================================
   API FUNCTIONS
============================================================ */

/**
 * Server-side filtered + paginated misc item search
 */
export function fetchMiscItems(
  page = 1,
  limit = 10,
  filters: MiscItemSearchParams = {}
): Promise<MiscItemResponse> {
  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("limit", String(limit));

  if (filters.name) params.set("name", filters.name);
  if (filters.description) params.set("description", filters.description);
  if (filters.supplier) params.set("supplier", filters.supplier);

  return apiRequest(`/misc_items/search?${params.toString()}`, {
    method: "GET",
  });
}

/* ============================================================
   CRUD
============================================================ */

export function fetchMiscItemById(id: string | number) {
  return apiRequest(`/misc_items/${id}`);
}

export function createMiscItem(data: Partial<MiscItemPayload>) {
  return apiRequest("/misc_items", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateMiscItem(
  id: string | number,
  data: Partial<MiscItemPayload>
) {
  return apiRequest(`/misc_items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteMiscItem(id: string | number) {
  return apiRequest(`/misc_items/${id}`, {
    method: "DELETE",
  });
}
