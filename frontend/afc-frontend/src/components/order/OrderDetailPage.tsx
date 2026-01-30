import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

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

import { patchOrder } from "../../api/ordersTable";
import type { OrderItemPayload } from "../../api/orderDetail";
import { 
  fetchOrderItems,
  allocateOrderItem,
  commitAllOrderItemTransactions,
  cancelTransaction,
  rollbackTransaction,
  fetchOrderItemTransactions,
} from "../../api/orderDetail";
import { allocateAll } from "../../api/ordersTable";


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

  const [items, setItems] = useState<OrderItemPayload[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  const [txnRefreshKey, setTxnRefreshKey] = useState(0);

  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

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

  async function refreshOrder() {
    if (!orderId) return;

    const [orderData, itemsData] = await Promise.all([
      fetchOrderById(orderId),
      fetchOrderItems(orderId),
    ]);

    setOrder(orderData);
    setItems(itemsData);

    // 🔑 force ALL OrderItemRow txns to reload
    setTxnRefreshKey((k) => k + 1);
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
      item => selectedItems.has(item.id) && !item.is_separator
    );

    if (nonSeparatorItems.length === 0) {
      alert("No valid items selected (separators cannot be allocated)");
      return;
    }

    try {
      await Promise.all(
        nonSeparatorItems.map(item => {
          const remaining = item.quantity_ordered - item.quantity_fulfilled;
          return remaining > 0 ? allocateOrderItem(item.id, remaining) : Promise.resolve();
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
      item => selectedItems.has(item.id) && !item.is_separator
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
      const errorMsg = err instanceof Error ? err.message : "Failed to commit selected items";
      alert(errorMsg);
    }
  }

  async function handleCancelSelected() {
    if (selectedItems.size === 0) {
      alert("No items selected");
      return;
    }

    const nonSeparatorItems = items.filter(
      item => selectedItems.has(item.id) && !item.is_separator
    );

    if (nonSeparatorItems.length === 0) {
      alert("No valid items selected");
      return;
    }

    if (!confirm("Cancel all pending transactions for selected items?")) {
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
      const errorMsg = err instanceof Error ? err.message : "Failed to cancel selected items";
      alert(errorMsg);
    }
  }

  async function handleRollbackSelected() {
    if (selectedItems.size === 0) {
      alert("No items selected");
      return;
    }

    const nonSeparatorItems = items.filter(
      item => selectedItems.has(item.id) && !item.is_separator
    );

    if (nonSeparatorItems.length === 0) {
      alert("No valid items selected");
      return;
    }

    if (!confirm("Rollback all committed transactions for selected items? This will create reversal transactions.")) {
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
      const errorMsg = err instanceof Error ? err.message : "Failed to rollback selected items";
      alert(errorMsg);
    }
  }


  /* ===================== RENDER ===================== */

  return (
    <MainLayout>
      <div className="flex justify-start flex-grow gap-x-4">
        {/* LEFT COLUMN */}
        <div className="max-w-7xl space-y-4 flex-3 bg-slate-100 ">
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

              onCreatedAtChange={(v) =>
                setOrder({ ...order, created_at: v })
              }
              onEtaChange={(v) =>
                setOrder({ ...order, eta: v })
              }
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
        <div className="flex-1 sticky top-1 self-start">
          <OrderDescription
            value={order.description}
            onChange={(v) =>
              setOrder({ ...order, description: v })
            }
            selectedItemsCount={selectedItems.size}
            onAllocateSelected={handleAllocateSelected}
            onCommitSelected={handleCommitSelected}
            onCancelSelected={handleCancelSelected}
            onRollbackSelected={handleRollbackSelected}
            disabled={order.status === "Completed"}
          />

          <div className="flex justify-end gap-2 mb-3">
            {saveError && (
              <p className="text-sm text-red-500 mt-1">{saveError}</p>
            )}
            

            {/* ===== ORDER ACTIONS ===== */}
            <div className="flex justify-end pt-2 gap-x-2">
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
      </div>
    </MainLayout>
  );
}
