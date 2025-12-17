import { apiRequest } from "./apiClient";

export interface Product {
  id: number;
  part_number: string;
  category: string;
}

export function fetchProducts() {
  return apiRequest("/products/names") as Promise<Product[]>;
}