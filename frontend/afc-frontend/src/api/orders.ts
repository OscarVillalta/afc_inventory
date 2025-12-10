import { apiRequest } from "./apiClient";

export interface OrderPayload {
  type: string;
  customer_supplier: string;
  description: string;
  line_items: any[];   // you can type this later
}

export function fetchOrders(page = 1, pageSize = 10) {
  return apiRequest(`/orders?page=${page}&pageSize=${pageSize}`);
}

export function createOrder(data: OrderPayload) {
  return apiRequest(`/orders`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateOrder(orderId: string, data: OrderPayload) {
  return apiRequest(`/orders/${orderId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function fetchOrderById(orderId: string) {
  return apiRequest(`/orders/${orderId}`);
}
