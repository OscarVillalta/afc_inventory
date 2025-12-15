import { apiRequest } from "./apiClient";


export interface TxnResponse {
  product_id: number;
  quantity_delta: number;

  reason: string;
  note: string;
}

export function autocommitTxn(data: TxnResponse): Promise<TxnResponse> {
  return apiRequest(`/transactions?auto_commit=true`,{
    method: "POST",
    body: JSON.stringify(data),
  });
}