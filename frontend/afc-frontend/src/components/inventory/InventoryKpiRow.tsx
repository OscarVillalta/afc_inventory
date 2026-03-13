import { useEffect, useState } from "react";
import { fetchInventoryStats } from "../../api/inventoryStats";
import type { InventoryStats } from "../../api/inventoryStats";

interface KpiCardProps {
  label: string;
  value: number | string;
  borderColor: string;
  valueColor: string;
  trend?: string;
}

function KpiCard({ label, value, borderColor, valueColor, trend }: KpiCardProps) {
  return (
    <div
      className={`flex-1 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden min-w-[150px] border-t-4 ${borderColor} mt-5`}
    >
      <div className="px-5 py-4">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">
          {label}
        </p>
        <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
        {trend && <p className="text-xs text-gray-400 mt-1">{trend}</p>}
      </div>
    </div>
  );
}

export default function InventoryKpiRow({ refreshToken }: { refreshToken?: number }) {
  const [stats, setStats] = useState<InventoryStats | null>(null);

  useEffect(() => {
    fetchInventoryStats()
      .then(setStats)
      .catch((err) => {
        console.error("Failed to load inventory stats:", err);
        setStats(null);
      });
  }, [refreshToken]);

  if (!stats) {
    return (
      <div className="flex flex-wrap gap-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex-1 h-24 bg-white rounded-lg animate-pulse min-w-[150px] border-t-4 border-gray-200"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-4">
      <KpiCard
        label="Total SKUs"
        value={stats.total_skus}
        borderColor="border-blue-500"
        valueColor="text-gray-800"
      />
      <KpiCard
        label="Low Stock"
        value={stats.low_stock_skus}
        borderColor="border-amber-500"
        valueColor="text-amber-600"
      />
      <KpiCard
        label="Backordered"
        value={stats.backordered_skus}
        borderColor="border-red-500"
        valueColor="text-red-600"
      />
      <KpiCard
        label="Reserved Units"
        value={stats.reserved_total}
        borderColor="border-purple-500"
        valueColor="text-gray-800"
      />
      <KpiCard
        label="Ordered Units"
        value={stats.ordered_total}
        borderColor="border-green-500"
        valueColor="text-gray-800"
      />
    </div>
  );
}
