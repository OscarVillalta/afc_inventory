import { apiRequest } from "./apiClient";

export interface Supplier {
  id: number;
  name: string;
}

export function fetchSuppliers() {
  return apiRequest("/suppliers") as Promise<Supplier[]>;
}
