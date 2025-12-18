import { apiRequest } from "./apiClient";

/* ============================================================
   TYPES — match /air_filters/search
============================================================ */

export interface AirFilterPayload {
  id: number;
  product_id: number;
  part_number: string;
  merv_rating: number;

  height: number;
  width: number;
  depth: number;

  filter_category: string;
  supplier_name: string;

  on_hand: number;
  reserved: number;
  ordered: number;
  available: number;
  backordered: number;
}

export interface AirFilterResponse {
  page: number;
  limit: number;
  count: number;
  total: number;
  results: AirFilterPayload[];
}

/* ============================================================
   SEARCH PARAMS
============================================================ */

export interface AirFilterSearchParams {
  part_number?: string;
  supplier?: string;
  category?: string;
  merv?: number;
  height?: number;
  width?: number;
  depth?: number;
  location?: number;
}

/* ============================================================
   API FUNCTIONS
============================================================ */

/**
 * Server-side filtered + paginated air filter search
 */
export function fetchAirFilters(
  page = 1,
  limit = 10,
  filters: AirFilterSearchParams = {}
): Promise<AirFilterResponse> {
  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("limit", String(limit));

  if (filters.part_number) params.set("part_number", filters.part_number);
  if (filters.supplier) params.set("supplier", filters.supplier);
  if (filters.category !== undefined) params.set("category", String(filters.category));
  if (filters.merv !== undefined) params.set("merv", String(filters.merv));
  if (filters.height !== undefined) params.set("height", String(filters.height));
  if (filters.width !== undefined) params.set("width", String(filters.width));
  if (filters.depth !== undefined) params.set("depth", String(filters.depth));
  if (filters.location !== undefined) params.set("location", String(filters.location));

  return apiRequest(`/air_filters/search?${params.toString()}`, {
    method: "GET",
  });
}

/* ============================================================
   CRUD (unchanged)
============================================================ */

export function fetchAirFilterById(id: string | number) {
  return apiRequest(`/air_filters/${id}`);
}

export function createAirFilter(data: AirFilterPayload) {
  return apiRequest("/air_filters", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateAirFilter(
  id: string | number,
  data: Partial<AirFilterPayload>
) {
  return apiRequest(`/air_filters/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteAirFilter(id: string | number) {
  return apiRequest(`/air_filters/${id}`, {
    method: "DELETE",
  });
}
