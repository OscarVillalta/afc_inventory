import { useState } from "react";

/* ===================== TYPES ===================== */

export type OrderType = "incoming" | "outgoing";
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
  onTypeChange: (v: OrderType) => void;
  onCreatedAtChange: (v: string) => void;
  onEtaChange: (v: string) => void;
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

  onTypeChange,
  onCreatedAtChange,
  onEtaChange,
}: Props) {
  const [open, setOpen] = useState(true);

  const entityLabel = type === "outgoing" ? "Customer" : "Supplier";

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
        <div className="px-6 pb-4 text-sm text-gray-600 grid grid-cols-2 gap-4">

          {/* Type */}
          <div>
            <p className="font-medium text-gray-700">Type</p>
            <select
              className="select select-bordered select-sm w-full"
              value={type}
              onChange={(e) => onTypeChange(e.target.value as OrderType)}
            >
              <option value="outgoing">Outgoing</option>
              <option value="incoming">Incoming</option>
            </select>
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
