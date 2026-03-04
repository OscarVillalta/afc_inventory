import { apiRequest } from "./apiClient";
import type { OrderDetailPayload } from "./ordersTable";

export type OutgoingOrderType = "Installation" | "Will Call" | "Shipment" | "Delivery";

export type Department =
  | "SALES"
  | "LOGISTICS"
  | "DELIVERY_DEPT"
  | "SERVICE"
  | "ACCOUNTING";

export interface OrderTrackerPayload {
  id: number;
  order_id: number;
  current_department: Department;
  step_index: number;
  updated_at: string;
}

export interface OrderHistoryPayload {
  id: number;
  order_id: number;
  from_department: Department | null;
  to_department: Department;
  action_taken: string;
  performed_by: string;
  completed_at: string;
  comments?: string | null;
}

/** Joined view: an Order with its current tracking status and full history. */
export interface OrderWithTracking {
  order: OrderDetailPayload;
  tracker: OrderTrackerPayload | null;
  history: OrderHistoryPayload[];
}

/** Single row returned by the GET /packing-slips endpoint. */
export interface PackingSlipResult {
  id: number;
  order_number: string;
  external_order_number?: string | null;
  order_type?: string | null;
  status: string;
  description?: string | null;
  customer_name?: string | null;
  created_at: string;
  completed_at?: string | null;
  eta?: string | null;
  is_paid: boolean;
  is_invoiced: boolean;
  tracker: OrderTrackerPayload | null;
  history: OrderHistoryPayload[];
}

export interface PackingSlipsResponse {
  page: number;
  limit: number;
  total: number;
  status_counts: {
    "Not Started": number;
    "In Progress": number;
    Completed: number;
  };
  results: PackingSlipResult[];
}

export function fetchOrderTracking(orderId: number | string) {
  return apiRequest(`/orders/${orderId}/tracker`) as Promise<OrderWithTracking>;
}

export function initOrderTracker(
  orderId: number | string,
  payload: { current_department: Department; step_index?: number }
) {
  return apiRequest(`/orders/${orderId}/tracker`, {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<OrderTrackerPayload>;
}

export function updateOrderTracker(
  orderId: number | string,
  payload: { current_department?: Department; step_index?: number }
) {
  return apiRequest(`/orders/${orderId}/tracker`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }) as Promise<OrderTrackerPayload>;
}

export function addOrderHistory(
  orderId: number | string,
  payload: {
    from_department?: Department | null;
    to_department: Department;
    action_taken: string;
    performed_by: string;
    comments?: string | null;
  }
) {
  return apiRequest(`/orders/${orderId}/history`, {
    method: "POST",
    body: JSON.stringify(payload),
  }) as Promise<OrderHistoryPayload>;
}

export function patchOrderPaidInvoiced(
  orderId: number | string,
  payload: { is_paid?: boolean; is_invoiced?: boolean }
) {
  return apiRequest(`/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function fetchPackingSlips(params?: {
  page?: number;
  limit?: number;
  search?: string;
  tracker_status?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.search) query.set("search", params.search);
  if (params?.tracker_status) query.set("tracker_status", params.tracker_status);
  return apiRequest(`/packing-slips?${query.toString()}`) as Promise<PackingSlipsResponse>;
}
