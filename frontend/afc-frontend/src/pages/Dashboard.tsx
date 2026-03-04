import MainLayout from "../layouts/MainLayout";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  return (
    <MainLayout>
      <div className="p-6 space-y-10">

        {/* PAGE TITLE */}
        <h1 className="text-3xl font-bold text-gray-800">Dashboard Overview</h1>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="stat bg-white rounded-xl shadow border border-gray-100 p-4">
            <div className="stat-title text-gray-500">Total Products</div>
            <div className="stat-value text-primary">342</div>
            <div className="stat-desc text-xs text-gray-400">Updated today</div>
          </div>

          <div className="stat bg-white rounded-xl shadow border border-gray-100 p-4">
            <div className="stat-title text-gray-500">Orders Pending</div>
            <div className="stat-value text-warning">12</div>
            <div className="stat-desc text-xs text-gray-400">4 require approval</div>
          </div>

          <div className="stat bg-white rounded-xl shadow border border-gray-100 p-4">
            <div className="stat-title text-gray-500">Low Stock Items</div>
            <div className="stat-value text-error">7</div>
            <div className="stat-desc text-xs text-gray-400">Below reorder point</div>
          </div>
        </div>

        {/* NEW SECTION: STOCK SNAPSHOT */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <div className="stat bg-white rounded-xl shadow border border-gray-100 p-4">
            <div className="stat-title text-gray-500">SKUs Tracked</div>
            <div className="stat-value text-green-600">684</div>
          </div>

          <div className="stat bg-white rounded-xl shadow border border-gray-100 p-4">
            <div className="stat-title text-gray-500">Avg. Days of Supply</div>
            <div className="stat-value text-orange-500">32.4</div>
          </div>

          <div className="stat bg-white rounded-xl shadow border border-gray-100 p-4">
            <div className="stat-title text-gray-500">Stock Value</div>
            <div className="stat-value text-purple-500">$312k</div>
          </div>
        </div>

        {/* CHARTS + ALERTS LAYOUT */}
        <div className="grid grid-cols-1 gap-8">

          {/* INVENTORY MOVEMENT CHART */}
          <div className="bg-white rounded-xl p-6 shadow border border-gray-100">
            <h2 className="text-xl font-semibold mb-4">Inventory Movement</h2>
            <p className="text-sm text-gray-500 mb-4">
              Weekly inbound vs outbound units
            </p>

            {/* Placeholder chart — replace with real chart component later */}
            <div className="h-48 w-full bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 flex items-center justify-center text-blue-400">
              Chart Placeholder
            </div>
          </div>
        </div>

        {/* RECENT ACTIVITY FEED */}<div className="bg-white rounded-xl p-6 shadow border border-gray-100">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>

          <table className="table w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b">
                <th className="py-3">Activity</th>
                <th className="py-3">Details</th>
                <th className="py-3">Type</th>
                <th className="py-3 text-right">Timestamp</th>
              </tr>
            </thead>

            <tbody>
              {/* ROW 1 */}
              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 font-medium">FGP-12x24x2</td>
                <td className="py-3 text-gray-600">Received 120 units</td>
                <td className="py-3">
                  <span className="badge bg-blue-100 text-blue-700 border-blue-200">
                    Receipt
                  </span>
                </td>
                <td className="py-3 text-right text-gray-500">Today · 10:22 AM</td>
              </tr>

              {/* ROW 2 */}
              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 font-medium">Order #100028</td>
                <td className="py-3 text-gray-600">Marked as Completed</td>
                <td className="py-3">
                  <span className="badge bg-green-100 text-green-700 border-green-200">
                    Order
                  </span>
                </td>
                <td className="py-3 text-right text-gray-500">Yesterday · 3:15 PM</td>
              </tr>

              {/* ROW 3 */}
              <tr className="hover:bg-gray-50">
                <td className="py-3 font-medium">M13 V-Bank</td>
                <td className="py-3 text-gray-600">Adjustment: corrected to 58 units</td>
                <td className="py-3">
                  <span className="badge bg-orange-100 text-orange-700 border-orange-200">
                    Adjustment
                  </span>
                </td>
                <td className="py-3 text-right text-gray-500">Mar 29 · 9:40 AM</td>
              </tr>
            </tbody>
          </table>
        </div>


        {/* QUICK ACTIONS */}
        <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button onClick={()=>navigate("/order")} className="btn bg-blue-600 text-white hover:bg-blue-700 w-full">
              ➕ Create Order
            </button>
            <button className="btn bg-green-600 text-white hover:bg-green-700 w-full">
              📦 Add Inventory Item
            </button>
            <button className="btn bg-yellow-500 text-white hover:bg-yellow-600 w-full">
              📥 Edit Orders
            </button>
            <button className="btn bg-gray-700 text-white hover:bg-gray-800 w-full">
              📊 View Reports 
            </button>
          </div>
        </div>

      </div>
    </MainLayout>
  );
}
/*View Reports should return an excel that will download a report based on dates like 12/1/2025-12/30/2025 and downloads all incoming and outgoing*/
