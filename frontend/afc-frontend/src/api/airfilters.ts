import { apiRequest } from "./apiClient";

export interface AirFilterPayload {
  total: number;

  id: number;
  part_number: string;
  merv_rating: number;

  height: number;
  width: number;
  depth: number;

  filter_category: number;
  supplier_name: string;

  on_hand: number;
  reserved: number;
  ordered: number;

}

export interface AirFilterResponse {
  count: number;  
  limit: number;
  page: number;
  results: AirFilterPayload[];
  total: number;
}

export function fetchAirFilters(page = 1, pageSize = 25): Promise<AirFilterResponse> {
  return apiRequest(`/air_filters/search?page=${page}&pages ize=${pageSize}`,{
    method: "GET"
  });
}

export function fetchAirFilterById(id: string | number) {
  return apiRequest(`/air_filters/${id}`);
}

export function createAirFilter(data: AirFilterPayload) {
  return apiRequest("/air_filters", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateAirFilter(id: string | number, data: Partial<AirFilterPayload>) {
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