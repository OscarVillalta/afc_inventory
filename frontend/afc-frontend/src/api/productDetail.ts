import { apiRequest } from "./apiClient";

export interface ProductDetail {
  id: number;
  category: string;
  reference_id: number;
  details: {
    part_number?: string;
    name?: string;
    supplier_name?: string;
    filter_category?: string;
    height?: number;
    width?: number;
    depth?: number;
    merv_rating?: number;
    description?: string;
  };
  quantity: {
    on_hand: number;
    reserved: number;
    ordered: number;
    available: number;
    backordered: number;
  };
}

export interface TransactionItem {
  id: number;
  product_id: number;
  quantity_delta: number;
  reason: string;
  state: string;
  note: string;
  created_at: string;
  committed_at?: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  allocated_quantity: number;
  committed_quantity: number;
  order_number?: string;
  order_type?: string;
  cs_name?: string;
  eta?: string;
  status?: string;
}

export async function fetchProductDetail(productId: number): Promise<ProductDetail> {
  return apiRequest(`/products/${productId}`) as Promise<ProductDetail>;
}

export async function fetchProductTransactions(productId: number, page = 1, limit = 10) {
  return apiRequest(`/transactions/search?product_id=${productId}&page=${page}&limit=${limit}`) as Promise<{
    page: number;
    limit: number;
    total: number;
    results: TransactionItem[];
  }>;
}

export async function fetchProductOrderItems(productId: number) {
  // This will fetch order items related to this product
  // We'll need to check backend API for the exact endpoint
  return apiRequest(`/order-items/search?product_id=${productId}`) as Promise<OrderItem[]>;
}
