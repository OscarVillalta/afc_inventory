import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import MainLayout from "../../layouts/MainLayout";
import OrderHeader from "./OrderHeader";
import OrderMetaCard from "./OrderMetaCard";
import OrderDescription from "./OrderDescription";
import OrderSectionAccordion from "./OrderSectionAccordion";

import { fetchOrderById } from "../../api/ordersTable";
import type { Customer } from "../../api/customers";
import { fetchCustomers } from "../../api/customers";
import type { Supplier } from "../../api/suppliers";
import { fetchSuppliers } from "../../api/suppliers";

import { patchOrder } from "../../api/ordersTable";
import type { OrderSectionPayload } from "../../api/orderDetail";
import { fetchOrderSections } from "../../api/orderDetail";


/* ===================== TYPES ===================== */

type OrderType = "incoming" | "outgoing";
type OrderStatus = "Pending" | "Partially Fulfilled" | "Completed";

interface OrderDetailPayload {
  id: number;
  order_number: string;
  type: OrderType;
  cs_name: string;
  cs_id: number;
  status: OrderStatus;
  description: string;
  created_at: string;
  completed_at?: string | null;
  eta?: string | null;
}

/* ===================== COMPONENT ===================== */

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);

  const [order, setOrder] = useState<OrderDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [sections, setSections] = useState<OrderSectionPayload[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);

  function handleTypeChange(newType: OrderType) {
  setOrder((prev) =>
    prev
      ? {
          ...prev,
          type: newType,
        }
      : prev
  );

  // 🔑 Clear entity selection when type flips
  setSelectedEntityId(null);
  }

async function handleSave() {
  if (!order || !orderId) return;
  if (!selectedEntityId) {
    setSaveError("Customer / Supplier is required.");
    return;
  }

  setSaving(true);
  setSaveError(null);

  try {
    const updated = await patchOrder(orderId, {
      type: order.type,
      cs_id: selectedEntityId,
      description: order.description,
      created_at: order.created_at,
      eta: order.eta ?? null,
    });

    // Update local state with server truth
    setOrder(updated);
    setSelectedEntityId(updated.cs_id ?? null);
  } catch (err) {
    setSaveError("Failed to save order changes.");
  } finally {
    setSaving(false);
  }
}

  /* ===================== FETCH ORDER ===================== */

  useEffect(() => {
    if (!orderId) return;

    setLoading(true);
    setError(null);

    fetchOrderById(orderId)
      .then((data) => {
        setOrder(data);
      })
      .catch(() => {
        setError("Failed to load order.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [orderId]);

  useEffect(() => {
    if (!order) return;

    setSelectedEntityId(order.cs_id ?? null);
  }, [order?.id]);

  useEffect(() => {
    fetchCustomers()
      .then(setCustomers)
      .catch(() => console.error("Failed to load customers"));

    fetchSuppliers()
      .then(setSuppliers)
      .catch(() => console.error("Failed to load suppliers"));
  }, []);

  /* ===================== FETCH Sections ===================== */

  useEffect(() => {
    if (!orderId) return;

    setSectionsLoading(true);

    fetchOrderSections(orderId)
      .then(setSections)
      .catch(() => console.error("Failed to load sections"))
      .finally(() => setSectionsLoading(false));
  }, [orderId]);

  /* ===================== STATES ===================== */

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 text-gray-400">Loading order…</div>
      </MainLayout>
    );
  }

  if (error || !order) {
    return (
      <MainLayout>
        <div className="p-6 text-red-500">
          {error ?? "Order not found"}
        </div>
      </MainLayout>
    );
  }

  /* ===================== RENDER ===================== */

  return (
    <MainLayout>
      <div className="flex justify-start flex-grow gap-x-4">
        {/* LEFT COLUMN */}
        <div className="max-w-7xl space-y-4 flex-3 bg-slate-100">
          <OrderHeader
            orderNumber={order.order_number}
            type={order.type}
            status={order.status}
          />

          <div className="lg:col-span-8 space-y-4">
            <OrderMetaCard
              type={order.type}
              status={order.status}
              createdAt={order.created_at}
              completedAt={order.completed_at}
              eta={order.eta}

              entities={order.type === "outgoing" ? customers : suppliers}
              selectedEntityId={selectedEntityId}
              onEntityChange={setSelectedEntityId}

              onTypeChange={handleTypeChange}
              onCreatedAtChange={(v) =>
                setOrder({ ...order, created_at: v })
              }
              onEtaChange={(v) =>
                setOrder({ ...order, eta: v })
              }
            />
          </div>

          {sectionsLoading ? (
              <div className="p-4 text-gray-400">Loading sections…</div>
            ) : sections.length === 0 ? (
              <div className="p-4 text-gray-400 italic">
                No sections yet
              </div>
            ) : (
              <OrderSectionAccordion sections={sections} type={order.type} />
            )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex-1">
          <OrderDescription
            value={order.description}
            onChange={(v) =>
              setOrder({ ...order, description: v })
            }
          />

          <div className="flex justify-end gap-2 mb-3">
            {saveError && (
              <p className="text-sm text-red-500 mt-1">{saveError}</p>
            )}
            <button
              className="btn btn-sm btn-outline"
              onClick={() => window.location.reload()}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              className="btn btn-sm btn-primary"
              disabled={saving || selectedEntityId === null}
              onClick={handleSave}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
