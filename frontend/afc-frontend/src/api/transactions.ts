import { apiRequest } from "./apiClient";


export interface createTxnRequest {
  product_id: number;
  quantity_delta: number;

  reason: string;
  note: string;
}

export function autocommitTxn(data: createTxnRequest): Promise<createTxnRequest> {
  return apiRequest(`/transactions?auto_commit=true`,{
    method: "POST",
    body: JSON.stringify(data),
  });
}