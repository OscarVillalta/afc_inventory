import { apiRequest } from "./apiClient";

export interface Product {
  id: number;
  part_number: string | null;
  category: string;
}

export interface ChildProductName {
  id: number;
  parent_product_id: number;
  part_number?: string;
  air_filter?: { part_number?: string };
  misc_item?: { name?: string };
  stock_item?: { name?: string };
}

export function fetchProducts() {
  return apiRequest("/products/names") as Promise<Product[]>;
}

export function fetchChildProducts() {
  return apiRequest("/child_products") as Promise<ChildProductName[]>;
}
