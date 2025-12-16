import { apiRequest } from "./apiClient";

export interface customerResponse{
    customers: Customer[]
}

export interface Customer {
  id: number;
  name: string;
}

export function fetchCustomers() {
  return apiRequest("/customers")as Promise<Customer[]>;
}
