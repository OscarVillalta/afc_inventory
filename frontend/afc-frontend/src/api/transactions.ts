import { apiRequest } from "./apiClient";


export interface createTxnRequest {
  product_id: number;
  quantity_delta: number;

  reason: string;
  note: string;
}

export interface TransactionPayload {
  id: number;
  product_id: number | null;
  child_product_id?: number | null;
  order_id?: number | null;
  order_item_id?: number | null;
  quantity_delta: number;
  reason?: string | null;
  state: "pending" | "committed" | "cancelled" | "rolled_back";
  note?: string | null;
  created_at: string;
  last_updated_at: string;
  ledger_sequence?: number | null;
}

export interface TransactionListResponse {
  page: number;
  limit: number;
  total: number;
  results: TransactionPayload[];
}

export interface TransactionFilters {
  child_product_id?: number;
  order_id?: number;
  product_name?: string;
  state?: string;
  reason?: string;
  note?: string;
  start_date?: string;
  end_date?: string;
  before_date?: string;
  after_date?: string;
}

export interface ProduceRequest {
  source_product_id?: number;
  source_child_product_id?: number;
  target_product_id?: number;
  target_child_product_id?: number;
  source_quantity: number;
  target_quantity: number;
  reason?: string;
  note?: string;
}

export interface TransactionSummary {
  total: number;
  net_quantity_change: number;
  committed_count: number;
  pending_count: number;
}

export function fetchTransactionSummary(
  filters?: TransactionFilters,
): Promise<TransactionSummary> {
  const params = new URLSearchParams();

  if (filters) {
    if (filters.product_name) params.set("product_name", filters.product_name);
    if (typeof filters.order_id === "number") params.set("order_id", String(filters.order_id));
    if (filters.state && filters.state !== "All") params.set("state", filters.state.toLowerCase());
    if (filters.reason) params.set("reason", filters.reason);
    if (filters.note) params.set("note", filters.note);
    if (filters.start_date) params.set("start_date", filters.start_date);
    if (filters.end_date) params.set("end_date", filters.end_date);
    if (filters.before_date) params.set("before_date", filters.before_date);
    if (filters.after_date) params.set("after_date", filters.after_date);
  }

  return apiRequest(`/transactions/summary?${params.toString()}`, {
    method: "GET",
  });
}

export function fetchTransactions(
  page = 1,
  limit = 10,
  filters?: TransactionFilters,
): Promise<TransactionListResponse> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  
  if (filters) {
    if (typeof filters.child_product_id === "number") {
      params.set("child_product_id", String(filters.child_product_id));
    }
    if (filters.product_name) {
      params.set("product_name", filters.product_name);
    }
    if (typeof filters.order_id === "number") {
      params.set("order_id", String(filters.order_id));
    }
    if (filters.state && filters.state !== "All") {
      params.set("state", filters.state.toLowerCase());
    }
    if (filters.reason) {
      params.set("reason", filters.reason);
    }
    if (filters.note) {
      params.set("note", filters.note);
    }
    if (filters.start_date) {
      params.set("start_date", filters.start_date);
    }
    if (filters.end_date) {
      params.set("end_date", filters.end_date);
    }
    if (filters.before_date) {
      params.set("before_date", filters.before_date);
    }
    if (filters.after_date) {
      params.set("after_date", filters.after_date);
    }
  }
  
  return apiRequest(`/transactions/search?${params.toString()}`, {
    method: "GET",
  });
}

export function autocommitTxn(data: createTxnRequest): Promise<createTxnRequest> {
  console.log(JSON.stringify({
      ...data,
    }))
  return apiRequest(`/transactions?auto_commit=true`,{
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function createItemFulfillmentTxn(payload: {
  product_id: number;
  order_id: number;
  order_item_id: number;
  quantity_delta: number;
  note?: string;
}) {
  console.log(JSON.stringify({
      ...payload,
    }))
  return apiRequest("/transactions?auto_commit=true", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
    }),
  });
}

export function produceInventory(data: ProduceRequest) {
  return apiRequest("/transactions/produce", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
