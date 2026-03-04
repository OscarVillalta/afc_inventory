import { apiRequest } from "./apiClient";

export interface InventoryStats {
  total_skus: number;
  low_stock_skus: number;
  backordered_skus: number;
  reserved_total: number;
  ordered_total: number;
}

export function fetchInventoryStats(): Promise<InventoryStats> {
  return apiRequest("/inventory/stats", { method: "GET" });
}
