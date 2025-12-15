export interface OrderTransaction {
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
  transactions: OrderTransaction[];
}

export interface OrderSection {
  id: number;
  title: string;
  items: OrderLineItem[];
}

export const mockOrderSections: OrderSection[] = [
  {
    id: 1,
    title: "Main Filters",
    items: [
      {
        id: 101,
        part_number: "F8V4GL-1224-GWB",
        qty_requested: 20,
        qty_fulfilled: 15,
        comment: "Urgent replacement",
        status: "Partial",
        completion_date: "",
        transactions: [
          {
            id: 9001,
            quantity_change: +10,
            note: "Initial shipment",
            date: "2024-01-12",
          },
          {
            id: 9002,
            quantity_change: +5,
            note: "Partial backorder received",
            date: "2024-01-18",
          },
        ],
      },
      {
        id: 102,
        part_number: "AC50S-24246",
        qty_requested: 12,
        qty_fulfilled: 12,
        comment: "",
        status: "Completed",
        completion_date: "2024-01-10",
        transactions: [
          {
            id: 9003,
            quantity_change: +12,
            note: "Complete shipment",
            date: "2024-01-10",
          },
        ],
      },
    ],
  },
];



