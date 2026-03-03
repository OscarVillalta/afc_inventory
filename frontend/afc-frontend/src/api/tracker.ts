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
