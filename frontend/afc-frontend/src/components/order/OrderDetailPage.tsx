import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import MainLayout from "../../layouts/MainLayout";
import OrderHeader from "./OrderHeader";
import OrderMetaCard from "./OrderMetaCard";
import OrderDescription from "./OrderDescription";
import OrderItemsTable from "./Items/OrderItemsTable";

import { fetchOrderById } from "../../api/ordersTable";
import type { Customer } from "../../api/customers";
import { fetchCustomers } from "../../api/customers";
import type { Supplier } from "../../api/suppliers";
import { fetchSuppliers } from "../../api/suppliers";

import { patchOrder, deleteOrder } from "../../api/ordersTable";
import type { OrderItemPayload } from "../../api/orderDetail";
import { 
  fetchOrderItems,
  fetchOrderSerialized,
  allocateOrderItem,
  commitAllOrderItemTransactions,
  cancelTransaction,
  rollbackTransaction,
  fetchOrderItemTransactions,
} from "../../api/orderDetail";

import { fetchOrderTracking } from "../../api/tracker";
import type { OrderWithTracking } from "../../api/tracker";
import OrderLifecycleCard from "./OrderLifecycleCard";


import type { OrderType } from "../../constants/orderTypes";
import { isOutgoingType } from "../../constants/orderTypes";

/* ===================== TYPES ===================== */

type OrderStatus = "Pending" | "Partially Fulfilled" | "Completed";

interface OrderDetailPayload {
  id: number;
  order_number: string;
  external_order_number?: string | null;
  type: OrderType;
  cs_name: string;
  cs_id: number;
  status: OrderStatus;
  description: string;
  created_at: string;
  completed_at?: string | null;
  eta?: string | null;
  is_paid?: boolean;
  is_invoiced?: boolean;
}

/* ===================== COMPONENT ===================== */

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);

  const [order, setOrder] = useState<OrderDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [deleting, setDeleting] = useState(false);

  const [items, setItems] = useState<OrderItemPayload[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  const [txnRefreshKey, setTxnRefreshKey] = useState(0);

  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const [trackingData, setTrackingData] = useState<OrderWithTracking | null>(null);

  // Debounce ref for auto-save
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);

  function buildPatch(overrides: Parameters<typeof patchOrder>[1] = {}): Parameters<typeof patchOrder>[1] {
    return {
      cs_id: selectedEntityId ?? undefined,
      type: order?.type,
      description: order?.description,
      created_at: order?.created_at,
      eta: order?.eta ?? null,
      ...overrides,
    };
  }

  function scheduleAutoSave(patch: Parameters<typeof patchOrder>[1]) {
    if (!orderId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        const updated = await patchOrder(orderId, patch);
        setOrder(updated);
        setSelectedEntityId(updated.cs_id ?? null);
        setAutoSaveError(null);
      } catch (err) {
        console.error("Auto-save failed:", err);
        setAutoSaveError("Auto-save failed. Please refresh the page.");
      }
    }, 600);
  }

  async function handleDeleteOrder() {
    if (!orderId || !order) return;
    if (!confirm(`Delete order ${order.order_number}? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      await deleteOrder(orderId);
      navigate("/orders/search");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete order";
      alert(msg);
    } finally {
      setDeleting(false);
    }
  }

  async function handleCopySerializedOrder() {
  if (!orderId) return;

  try {
    const itemIds =
      selectedItems.size > 0
        ? Array.from(selectedItems)
        : undefined;

    const { serialized } = await fetchOrderSerialized(orderId, itemIds);

    // Create temporary textarea
    const textArea = document.createElement("textarea");
    textArea.value = serialized;

    // Avoid scrolling to bottom
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand("copy");

    document.body.removeChild(textArea);

    if (!successful) {
      throw new Error("Copy command was unsuccessful");
    }

    setCopyStatus("copied");
    setTimeout(() => setCopyStatus("idle"), 2000);

  } catch (err) {
    console.error("Failed to copy order to clipboard:", err);
    setCopyStatus("error");
    setTimeout(() => setCopyStatus("idle"), 2000);
  }
}

  async function refreshOrder() {
    if (!orderId) return;

    const [orderData, itemsData, trackingResult] = await Promise.all([
      fetchOrderById(orderId),
      fetchOrderItems(orderId),
      fetchOrderTracking(orderId),
    ]);

    setOrder(orderData);
    setItems(itemsData);
    setTrackingData(trackingResult);

    // 🔑 force ALL OrderItemRow txns to reload
    setTxnRefreshKey((k) => k + 1);
  }

  /* ===================== FETCH ORDER ===================== */

  useEffect(() => {
    if (!orderId) return;

    setLoading(true);
    setError(null);

    Promise.all([fetchOrderById(orderId), fetchOrderTracking(orderId)])
      .then(([orderData, trackingResult]) => {
        setOrder(orderData);
        setTrackingData(trackingResult);
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


  /* ===================== FETCH Items ===================== */

  useEffect(() => {
    if (!orderId) return;

    setItemsLoading(true);

    fetchOrderItems(orderId)
      .then(setItems)
      .catch(() => console.error("Failed to load items"))
      .finally(() => setItemsLoading(false));
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

  async function handleAllocateSelected() {
    if (selectedItems.size === 0) {
      alert("No items selected");
      return;
    }

    const nonSeparatorItems = items.filter(
      item => selectedItems.has(item.id) && item.type !== "Unit_Separator" && item.type !== "Section_Separator"
    );

    if (nonSeparatorItems.length === 0) {
      alert("No valid items selected (separators cannot be allocated)");
      return;
    }

    try {
      await Promise.all(
        nonSeparatorItems.map(item => {
          return allocateOrderItem(item.id);
        })
      );
      await refreshOrder();
      setSelectedItems(new Set());
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to allocate selected items";
      alert(errorMsg);
    }
  }

  async function handleCommitSelected() {
    if (selectedItems.size === 0) {
      alert("No items selected");
      return;
    }

    const nonSeparatorItems = items.filter(
      item => selectedItems.has(item.id) && item.type !== "Unit_Separator" && item.type !== "Section_Separator"
    );

    if (nonSeparatorItems.length === 0) {
      alert("No valid items selected");
      return;
    }

    try {
      await Promise.all(
        nonSeparatorItems.map(item => commitAllOrderItemTransactions(item.id))
      );
      await refreshOrder();
      setSelectedItems(new Set());
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : (order?.type && isOutgoingType(order.type) ? "Failed to fulfill selected items" : "Failed to receive selected items");
      alert(errorMsg);
    }
  }

  async function handleCancelSelected() {
    if (selectedItems.size === 0) {
      alert("No items selected");
      return;
    }

    const nonSeparatorItems = items.filter(
      item => selectedItems.has(item.id) && item.type !== "Unit_Separator" && item.type !== "Section_Separator"
    );

    if (nonSeparatorItems.length === 0) {
      alert("No valid items selected");
      return;
    }

    if (!confirm(order?.type && isOutgoingType(order.type)
      ? "Cancel all transactions for selected items?"
      : "Cancel all orders for selected items?")) {
      return;
    }

    try {
      // Fetch all transactions in parallel
      const transactionsData = await Promise.all(
        nonSeparatorItems.map(item => fetchOrderItemTransactions(item.id))
      );

      // Cancel all pending transactions in parallel
      const cancelPromises = transactionsData.flatMap((transactions) => 
        transactions
          .filter(tx => tx.state === "pending")
          .map(tx => cancelTransaction(tx.id))
      );

      await Promise.all(cancelPromises);
      await refreshOrder();
      setSelectedItems(new Set());
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to cancel transactions";
      alert(errorMsg);
    }
  }

  async function handleRollbackSelected() {
    if (selectedItems.size === 0) {
      alert("No items selected");
      return;
    }

    const nonSeparatorItems = items.filter(
      item => selectedItems.has(item.id) && item.type !== "Unit_Separator" && item.type !== "Section_Separator"
    );

    if (nonSeparatorItems.length === 0) {
      alert("No valid items selected");
      return;
    }

    if (!confirm("Reverse all committed transactions for selected items? This will create reversal transactions.")) {
      return;
    }

    try {
      // Fetch all transactions in parallel
      const transactionsData = await Promise.all(
        nonSeparatorItems.map(item => fetchOrderItemTransactions(item.id))
      );

      // Rollback all committed transactions in parallel
      const rollbackPromises = transactionsData.flatMap((transactions) => 
        transactions
          .filter(tx => tx.state === "committed")
          .map(tx => rollbackTransaction(tx.id))
      );

      await Promise.all(rollbackPromises);
      await refreshOrder();
      setSelectedItems(new Set());
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to reverse selected items";
      alert(errorMsg);
    }
  }


  /* ===================== RENDER ===================== */

  return (
    <MainLayout>
      <div className="flex flex-col lg:flex-row justify-start flex-grow gap-4">
        {/* LEFT COLUMN */}
        <div className="max-w-7xl space-y-4 lg:flex-3 w-full bg-slate-100 ">
          <OrderHeader
            orderNumber={order.order_number}
            externalOrderNumber={order.external_order_number}
            type={order.type}
            status={order.status}
            currentDepartment={trackingData?.tracker?.current_department ?? null}
            onCopyOrder={handleCopySerializedOrder}
            copyStatus={copyStatus}
            selectedCount={selectedItems.size}
          />
          

          <div className="lg:col-span-8 space-y-4">
            <OrderMetaCard
              type={order.type}
              status={order.status}
              createdAt={order.created_at}
              completedAt={order.completed_at}
              eta={order.eta}

              entities={isOutgoingType(order.type) ? customers : suppliers}
              selectedEntityId={selectedEntityId}
              onEntityChange={(id) => {
                setSelectedEntityId(id);
                scheduleAutoSave(buildPatch({ cs_id: id }));
              }}

              onCreatedAtChange={(v) => {
                setOrder({ ...order, created_at: v });
                scheduleAutoSave(buildPatch({ created_at: v }));
              }}
              onEtaChange={(v) => {
                setOrder({ ...order, eta: v });
                scheduleAutoSave(buildPatch({ eta: v || null }));
              }}
              onTypeChange={(newType) => {
                setOrder({ ...order, type: newType });
                scheduleAutoSave(buildPatch({ type: newType }));
              }}
            />
          </div>

          <OrderItemsTable
            orderId={order.id}
            items={items}
            loading={itemsLoading}
            onRefresh={refreshOrder}
            orderType={order.type}
            orderStatus={order.status}
            txnRefreshKey={txnRefreshKey}
            selectedItems={selectedItems}
            onSelectedItemsChange={setSelectedItems}
          />
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:flex-1 w-full lg:w-auto lg:sticky lg:top-1 lg:self-start">
          <OrderDescription
            value={order.description}
            onChange={(v) => {
              setOrder({ ...order, description: v });
              scheduleAutoSave(buildPatch({ description: v }));
            }}
            selectedItemsCount={selectedItems.size}
            onAllocateSelected={handleAllocateSelected}
            onCommitSelected={handleCommitSelected}
            onCancelSelected={handleCancelSelected}
            onRollbackSelected={handleRollbackSelected}
            disabled={order.status === "Completed"}
            orderType={order.type}
          />

          <OrderLifecycleCard
            trackingData={trackingData}
            createdAt={order.created_at}
            status={order.status}
            isPaid={order.is_paid ?? false}
            isInvoiced={order.is_invoiced ?? false}
            orderId={order.id}
            orderType={order.type}
            onRefresh={refreshOrder}
          />

          <div className="flex justify-end pt-2 gap-x-2 items-center">
            {/* ===== ORDER ACTIONS ===== */}
            {autoSaveError && (
              <p className="text-sm text-red-500">{autoSaveError}</p>
            )}
            <button
              className="btn btn-sm btn-error"
              onClick={handleDeleteOrder}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Order"}
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
