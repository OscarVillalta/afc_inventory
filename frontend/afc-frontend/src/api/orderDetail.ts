import { apiRequest } from "./apiClient";

export interface OrderItemPayload {
  id: number;
  order_id: number;
  product_id: number;
  part_number: string;
  quantity_ordered: number;
  quantity_fulfilled: number;
  status:string;
  note?: string;
}

export interface OrderItemTransaction {
  id: number;
  quantity_delta: number;
  state: "pending" | "committed" | "cancelled" | "rolled_back";
  note?: string;
  created_at: string;
}

export interface OrderSectionPayload {
  id: number;
  title: string;
  description?: string | null;
  sort_order: number;
  status: string;
  items: OrderItemPayload[];
}

export function fetchOrderSections(orderId: string) {
  return apiRequest(
    `/orders/${orderId}/sections`
  ) as Promise <OrderSectionPayload[]>;
}

export function fetchOrderItemTransactions(itemId: number) {
  return apiRequest(
    `/order_items/${itemId}/transactions`
  ) as Promise <OrderItemTransaction[]>;
}

export function createOrderItemTransaction(
  payload: {
    product_id: number;
    order_id: number;
    order_item_id: number;
    quantity_delta: number;
    reason: string;
    note?: string;
  }
) {
    console.log(JSON.stringify(payload))
  // No auto_commit here — we want PENDING transactions
  return apiRequest(`/transactions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function commitTransaction(transactionId: number) {
  return apiRequest(`/transactions/${transactionId}/commit`, {
    method: "PATCH",
  });
}

export function createOrderItem(payload: {
  order_id: number;
  section_id: number;
  product_id: number;
  quantity_ordered: number;
  note?: string;

  
}) {
  console.log(JSON.stringify(payload))
  return apiRequest("/order_items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createOrderSection(payload: {
  order_id: number;
  title: string;
  description?: string;
}) {
  console.log(JSON.stringify(payload))
  return apiRequest("/order_sections", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

