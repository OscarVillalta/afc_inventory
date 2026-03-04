import MainLayout from "../layouts/MainLayout";
import OrdersTable from "../components/order/Table/OrdersTable";

export default function OrdersPage() {
  return (
    <MainLayout>
      {/* ===================== TABLE ===================== */}
      <OrdersTable reloadKey={0} />
    </MainLayout>
  );
}
