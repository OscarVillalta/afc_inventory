import MainLayout from "../layouts/MainLayout";

export default function Dashboard() {
  return (
    <MainLayout>
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Total Products</div>
          <div className="stat-value">0</div>
        </div>

        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Orders Pending</div>
          <div className="stat-value">0</div>
        </div>

        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Low Stock</div>
          <div className="stat-value">0</div>
        </div>
      </div>
    </MainLayout>
  );
}
