import { useEffect, useState } from "react";
import { fetchInventoryStats } from "../../api/inventoryStats";
import type { InventoryStats } from "../../api/inventoryStats";

interface KpiCardProps {
  label: string;
  value: number | string;
  color: string;
  icon: string;
}

function KpiCard({ label, value, color, icon }: KpiCardProps) {
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm min-w-[150px]">
      <div className={`text-2xl ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

export default function InventoryKpiRow({ refreshToken }: { refreshToken?: number }) {
  const [stats, setStats] = useState<InventoryStats | null>(null);

  useEffect(() => {
    fetchInventoryStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, [refreshToken]);

  if (!stats) return null;

  return (
    <div className="flex flex-wrap gap-3">
      <KpiCard label="Total SKUs" value={stats.total_skus} color="text-blue-600" icon="📦" />
      <KpiCard label="Low Stock" value={stats.low_stock_skus} color="text-amber-600" icon="⚠️" />
      <KpiCard label="Backordered" value={stats.backordered_skus} color="text-red-600" icon="🔴" />
      <KpiCard label="Reserved Units" value={stats.reserved_total} color="text-purple-600" icon="🔒" />
      <KpiCard label="Ordered Units" value={stats.ordered_total} color="text-green-600" icon="📋" />
    </div>
  );
}
