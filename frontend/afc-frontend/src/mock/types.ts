export interface Transaction {
  id: number;
  quantity_change: number;
  note: string;
  date: string;
}

export interface OrderLineItem {
  id: number;
  part_number: string;
  qty_requested: number;
  qty_fulfilled: number;
  comment: string;
  status: "Pending" | "Partial" | "Completed";
  completion_date?: string;
  transactions: Transaction[];
}

export interface OrderSection {
  id: number;
  title: string;
  items: OrderLineItem[];
}
