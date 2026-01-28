import { apiRequest } from "./apiClient";


export interface createTxnRequest {
  product_id: number;
  quantity_delta: number;

  reason: string;
  note: string;
}

export interface TransactionPayload {
  id: number;
  product_id: number;
  order_id?: number | null;
  order_item_id?: number | null;
  quantity_delta: number;
  reason?: string | null;
  state: "pending" | "committed" | "cancelled" | "rolled_back";
  note?: string | null;
  created_at: string;
}

export interface TransactionListResponse {
  page: number;
  limit: number;
  total: number;
  results: TransactionPayload[];
}

export function fetchTransactions(
  page = 1,
  limit = 10,
  product_name?: string,
): Promise<TransactionListResponse> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (product_name){
    params.set("product_name", product_name);
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
