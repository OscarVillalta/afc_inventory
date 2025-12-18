import { useState } from "react";
import { useNavigate } from "react-router-dom";

import MainLayout from "../layouts/MainLayout";
import OrdersTable from "../components/order/Table/OrdersTable";
import CreateOrderModal from "../components/order/Table/CreateOrderModal";

export default function OrdersPage() {
  const navigate = useNavigate();

  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <MainLayout>
      {/* ===================== HEADER ACTION ===================== */}
      <div className="px-6 pt-6 pb-10 w-full flex items-center justify-end">
        <button
          className="
            px-5 py-2.5 rounded-lg
            text-sm font-semibold text-white
            shadow-md transition
            cursor-pointer
            hover:shadow-lg hover:-translate-y-0.5
            active:translate-y-0
          "
          style={{
            background:
              "linear-gradient(90deg, #3A7BD5 0%, #2B60C8 100%)",
          }}
          onClick={() => setShowCreateModal(true)}
        >
          + Create Order
        </button>
      </div>

      {/* ===================== TABLE ===================== */}
      <OrdersTable />

      {/* ===================== CREATE MODAL ===================== */}
      <CreateOrderModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(orderId?: number) => {
          setShowCreateModal(false);

          // If backend returns ID → go straight to detail
          if (orderId) {
            navigate(`/orders/${orderId}`);
          }
        }}
      />
    </MainLayout>
  );
}
