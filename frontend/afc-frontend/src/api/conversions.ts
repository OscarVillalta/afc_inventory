import { apiRequest } from "./apiClient";

export interface ConversionDecreaseInput {
  product_id?: number;
  child_product_id?: number;
  quantity: number;
}

export interface ConversionIncreaseInput {
  product_id?: number;
  child_product_id?: number;
  quantity: number;
}

export interface ConversionInput {
  decreases: ConversionDecreaseInput[];
  increase: ConversionIncreaseInput;
  note?: string;
}

export interface ConversionBatchRequest {
  note?: string;
  order_id?: number;
  created_by?: string;
  conversions: ConversionInput[];
}

export function createConversionBatch(payload: ConversionBatchRequest) {
  return apiRequest("/conversion_batches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
