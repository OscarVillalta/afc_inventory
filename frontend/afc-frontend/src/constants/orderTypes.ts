/**
 * Canonical order type values stored in the database.
 * "Incoming" orders receive stock (require supplier).
 * All other types dispatch stock (require customer) and follow the outgoing tracker workflow.
 */
export type OrderType =
  | "incoming"
  | "installation"
  | "will_call"
  | "delivery"
  | "shipment";

export const OUTGOING_ORDER_TYPES: OrderType[] = [
  "installation",
  "will_call",
  "delivery",
  "shipment",
];

export const ALL_ORDER_TYPES: OrderType[] = [
  "incoming",
  "installation",
  "will_call",
  "delivery",
  "shipment",
];

/** Human-readable display label for each order type. */
export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  incoming: "Incoming",
  installation: "Installation",
  will_call: "Will Call",
  delivery: "Delivery",
  shipment: "Shipment",
};

/** Tailwind color classes for each order type badge. */
export const ORDER_TYPE_COLORS: Record<
  OrderType,
  { bg: string; text: string; border: string }
> = {
  incoming: {
    bg: "bg-green-600/20",
    text: "text-green-200",
    border: "border-green-400/40",
  },
  installation: {
    bg: "bg-blue-600/20",
    text: "text-blue-200",
    border: "border-blue-400/40",
  },
  will_call: {
    bg: "bg-purple-600/20",
    text: "text-purple-200",
    border: "border-purple-400/40",
  },
  delivery: {
    bg: "bg-teal-600/20",
    text: "text-teal-200",
    border: "border-teal-400/40",
  },
  shipment: {
    bg: "bg-cyan-600/20",
    text: "text-cyan-200",
    border: "border-cyan-400/40",
  },
};

/** Returns true if the type is an outgoing (customer-facing) order type. */
export function isOutgoingType(type: string): boolean {
  return OUTGOING_ORDER_TYPES.includes(type as OrderType);
}
