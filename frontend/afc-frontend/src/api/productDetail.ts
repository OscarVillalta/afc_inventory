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
  child_products?: ChildProductSummary[];
}

export interface ChildProductSummary {
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
}

export interface ChildProductDetail {
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
  parent_product?: {
    id: number;
    category: string;
    category_id: number;
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
  };
}

export interface TransactionItem {
  id: number;
  product_id: number | null;
  child_product_id?: number | null;
  order_id?: number | null;
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

export async function fetchChildProductDetail(childProductId: number): Promise<ChildProductDetail> {
  return apiRequest(`/child_products/${childProductId}`) as Promise<ChildProductDetail>;
}

export async function fetchProductTransactions(
  productId?: number,
  page = 1,
  limit = 10,
  childProductId?: number
) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));

  if (typeof productId === "number") {
    params.set("product_id", String(productId));
  }
  if (typeof childProductId === "number") {
    params.set("child_product_id", String(childProductId));
  }

  return apiRequest(`/transactions/search?${params.toString()}`) as Promise<{
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

export interface ProductOrderSummary {
  id: number;
  order_number?: string;
  type: string;
  cs_name: string;
  status: string;
  created_at: string;
  eta?: string;
  quantity?: number;
  need_by?: string;
}

export async function fetchProductOrders(
  productId: number, 
  orderType: 'incoming' | 'outgoing',
  limit: number = 5
): Promise<ProductOrderSummary[]> {
  const response = await apiRequest(
    `/orders/search?product_ids=${productId}&type=${orderType}&limit=${limit}`
  ) as { results: ProductOrderSummary[] };
  return response.results || [];
}
