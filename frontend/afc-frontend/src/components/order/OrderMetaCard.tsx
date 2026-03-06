import { useState } from "react";
import type { OrderType } from "../../constants/orderTypes";
import { ORDER_TYPE_LABELS, OUTGOING_ORDER_TYPES } from "../../constants/orderTypes";

/* ===================== TYPES ===================== */

export type { OrderType };
export type OrderStatus = "Pending" | "Partially Fulfilled" | "Completed";

export interface EntityOption {
  id: number;
  name: string;
}

interface Props {
  type: OrderType;
  status: OrderStatus;

  createdAt: string;
  completedAt?: string | null;
  eta?: string | null;

  /* Entity (Customer or Supplier) */
  entities: EntityOption[];
  selectedEntityId: number | null;
  onEntityChange: (id: number) => void;

  /* Handlers */
  onCreatedAtChange: (v: string) => void;
  onEtaChange: (v: string) => void;
  onTypeChange?: (newType: OrderType) => void;
}

/* ===================== COMPONENT ===================== */

export default function OrderMetaCard({
  type,
  status,
  createdAt,
  completedAt,
  eta,

  entities,
  selectedEntityId,
  onEntityChange,

  onCreatedAtChange,
  onEtaChange,
  onTypeChange,
}: Props) {
  const [open, setOpen] = useState(true);

  const entityLabel = type === "incoming" ? "Supplier" : "Customer";
  const canChangeType = type !== "incoming" && !!onTypeChange;

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-6 py-3 text-sm font-semibold"
      >
        <span>Order Details</span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {/* Content */}
      {open && (
        <div className="px-6 pb-4 text-sm text-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Type */}
          <div>
            <p className="font-medium text-gray-700">Type</p>
            {canChangeType ? (
              <select
                className="select select-bordered select-sm w-full"
                value={type}
                onChange={(e) => onTypeChange(e.target.value as OrderType)}
              >
                {OUTGOING_ORDER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ORDER_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            ) : (
              <p className="py-2">{ORDER_TYPE_LABELS[type] ?? type}</p>
            )}
          </div>

          {/* Created At */}
          <div>
            <p className="font-medium text-gray-700">Created</p>
            <input
              type="date"
              className="input input-bordered input-sm w-full"
              value={createdAt}
              onChange={(e) => onCreatedAtChange(e.target.value)}
            />
          </div>

          {/* Customer / Supplier */}
          <div>
            <p className="font-medium text-gray-700">{entityLabel}</p>
            <select
              className="select select-bordered select-sm w-full"
              value={selectedEntityId ?? ""}
              onChange={(e) => onEntityChange(Number(e.target.value))}
            >
              <option value="" disabled>
                Select {entityLabel}
              </option>

              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </div>

          {/* ETA */}
          <div>
            <p className="font-medium text-gray-700">ETA</p>
            <input
              type="date"
              className="input input-bordered input-sm w-full"
              value={eta ?? ""}
              min={createdAt}
              onChange={(e) => onEtaChange(e.target.value)}
            />
          </div>

          {/* Status (read-only) */}
          <div>
            <p className="font-medium text-gray-700">Status</p>
            <p className="py-2">{status}</p>
          </div>

          {/* Completed At (read-only) */}
          <div>
            <p className="font-medium text-gray-700">Completed</p>
            <p className="py-2">{completedAt ?? "—"}</p>
          </div>

        </div>
      )}
    </div>
  );
}
