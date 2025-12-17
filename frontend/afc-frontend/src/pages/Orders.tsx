import { useState } from "react";
import MainLayout from "../layouts/MainLayout";
import OrdersTable from "../components/order/Table/OrdersTable";
import { useNavigate } from 'react-router-dom'

export default function OrdersPage() {
  const navigate = useNavigate()

  return (
    <MainLayout>
      <div className="px-6 pt-6 pb-20 w-full flex items-center justify-end">
        <button
          className="
            px-5 py-2.5 rounded-lg 
            text-sm font-semibold text-white shadow-md
            hover:shadow-lg transition
            cursor-pointer
          "
          onClick={() => navigate('/detail')}
          style={{
            background: "linear-gradient(90deg, #3A7BD5 0%, #2B60C8 100%)",
          }}
        >
          + Create Order
        </button>
      </div>
      <OrdersTable />

    </MainLayout>
  );
}
