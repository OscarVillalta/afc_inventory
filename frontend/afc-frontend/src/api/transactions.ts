import { apiRequest } from "./apiClient";


export interface createTxnRequest {
  product_id: number;
  quantity_delta: number;

  reason: string;
  note: string;
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