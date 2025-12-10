import { apiRequest } from "./apiClient";

export interface AirFilterPayload {
  id: number;
  part_number: string;
  category: string;
  supplier: string;
  dimensions: string;
  merv: number;
  initial_resistance?: string;
  final_resistance?: string;
  height?: number;
  width?: number;
  depth?: number;
}

export function fetchAirFilters(page = 1, pageSize = 25) {
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
