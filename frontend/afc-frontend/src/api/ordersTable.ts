import { apiRequest } from "./apiClient";

export interface OrderRowItemPayload {
  id: number;
  type: string;
  cs_name: string;
  description: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
  external_order_number?: string | null;
}

export interface OrderResponse {
  count: number;  
  limit: number;
  page: number;
  results: OrderRowItemPayload[];
  total: number;
}

export interface OrderSearchParams {
  id?: number;
  order_number?: string;
  external_order_number?: string;
  description?: string;
  type?: string;
  status?: string;
  cs_name?: string;
  customer_name?: string;      // New: Filter by customer name
  supplier_name?: string;      // New: Filter by supplier name
  created_from?: string;   // YYYY-MM-DD
  created_to?: string;
  completed_from?: string;  // YYYY-MM-DD
  completed_to?: string;    // YYYY-MM-DD
  product_ids?: string;     // Comma-separated product IDs
}

export interface OrderDetailPayload {
  id: number;
  order_number: string;
  external_order_number: string;
  type: "incoming" | "outgoing";
  cs_name: string;
  status: "Pending" | "Partially Fulfilled" | "Completed";
  description: string;
  created_at: string;
  completed_at?: string | null;
  eta?: string | null;
}

export function fetchOrders(
  page = 1,
  pageSize = 10,
  filters: OrderSearchParams = {}
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
  });

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.append(key, value);
    }
  });

  return apiRequest(`/orders/search?${params.toString()}`);
}

export function fetchOrderById(orderId: string) {
  return apiRequest(`/orders/${orderId}`);
}

export function patchOrder(
  orderId: string,
  payload: {
    type?: "incoming" | "outgoing";
    cs_id?: number;
    description?: string;
    created_at?: string;
    eta?: string | null;
  }
) {
  return apiRequest(`/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function createOrder(payload: {
  type: "incoming" | "outgoing";
  customer_id?: number;
  supplier_id?: number;
  eta?: string | null;
  description?: string | null;
}) {
  console.log(JSON.stringify(payload))
  return apiRequest("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


export function allocateAll(orderId: number) {
  return apiRequest(`/orders/${orderId}/allocate-all`, {
    method: "POST",
  });
}

export function createOrderFromQB(payload: {
  reference_number: string;
  qb_doc_type: string;
}) {
  return apiRequest("/orders/from-qb", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}