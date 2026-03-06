import { useMemo, useState } from "react";
import type { OrderItemPayload } from "../../../api/orderDetail";
import type { OrderType } from "../../../constants/orderTypes";
import { isOutgoingType } from "../../../constants/orderTypes";

interface Props {
  items: OrderItemPayload[];
  orderType: OrderType;
}

interface ProductSummary {
  product_id: number;
  part_number: string;
  total_ordered: number;
  total_fulfilled: number;
  total_pending: number;
  on_hand: number | null;
  reserved: number | null;
  available: number | null;
}

function hasEnoughStock(product: ProductSummary, orderType: OrderType): boolean {
  if (product.on_hand === null) return true;
  const remaining = product.total_ordered - product.total_fulfilled;
  if (isOutgoingType(orderType)) {
    // Available stock + what's already reserved for this order covers the remaining
    const effectiveAvailable = (product.available ?? 0) + product.total_pending;
    return effectiveAvailable >= remaining;
  }
  // For incoming: fully allocated if pending + fulfilled >= ordered
  return product.total_pending + product.total_fulfilled >= product.total_ordered;
}

export default function OrderTotalsTab({ items, orderType }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<string>("__all__");

  // Extract unique buildings from Section_Separator items
  const buildings = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of items) {
      if (item.type === "Section_Separator") {
        const name = item.note || "Unnamed Building";
        if (!seen.has(name)) {
          seen.add(name);
          result.push(name);
        }
      }
    }
    return result;
  }, [items]);

  // Filter items to those belonging to the selected building
  const filteredItems = useMemo(() => {
    if (selectedBuilding === "__all__") return items;
    const result: OrderItemPayload[] = [];
    let inBuilding = false;
    for (const item of items) {
      if (item.type === "Section_Separator") {
        inBuilding = (item.note || "Unnamed Building") === selectedBuilding;
      }
      if (inBuilding) {
        result.push(item);
      }
    }
    return result;
  }, [items, selectedBuilding]);

  // Aggregate product totals from filtered items
  const productSummaries = useMemo(() => {
    const map = new Map<number, ProductSummary>();
    for (const item of filteredItems) {
      if (item.type === "Unit_Separator" || item.type === "Section_Separator") continue;
      if (!item.product_id) continue;
      const existing = map.get(item.product_id);
      if (existing) {
        existing.total_ordered += item.quantity_ordered;
        existing.total_fulfilled += item.quantity_fulfilled;
        existing.total_pending += item.quantity_pending ?? 0;
      } else {
        map.set(item.product_id, {
          product_id: item.product_id,
          part_number: item.part_number,
          total_ordered: item.quantity_ordered,
          total_fulfilled: item.quantity_fulfilled,
          total_pending: item.quantity_pending ?? 0,
          on_hand: item.on_hand,
          reserved: item.reserved,
          available: item.available,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.part_number.localeCompare(b.part_number)
    );
  }, [filteredItems]);

  const totalUniqueProducts = productSummaries.length;
  const totalOrdered = productSummaries.reduce((s, p) => s + p.total_ordered, 0);
  const totalFulfilled = productSummaries.reduce((s, p) => s + p.total_fulfilled, 0);
  const productsWithInventory = productSummaries.filter((p) => p.on_hand !== null);
  const allHaveEnoughStock =
    productsWithInventory.length > 0 &&
    productsWithInventory.every((p) => hasEnoughStock(p, orderType));

  const pendingLabel = isOutgoingType(orderType) ? "Reserved" : "Ordered";

  return (
    <div className="p-4 space-y-4">
      {/* Building filter */}
      {buildings.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Building:</label>
          <select
            className="select select-sm select-bordered"
            value={selectedBuilding}
            onChange={(e) => setSelectedBuilding(e.target.value)}
          >
            <option value="__all__">All Buildings</option>
            {buildings.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="text-xs text-gray-500">Unique Products</div>
          <div className="text-2xl font-bold text-gray-800">{totalUniqueProducts}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="text-xs text-gray-500">Total Ordered</div>
          <div className="text-2xl font-bold text-gray-800">{totalOrdered}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="text-xs text-gray-500">Total Fulfilled</div>
          <div className="text-2xl font-bold text-gray-800">{totalFulfilled}</div>
        </div>
        <div
          className={`rounded-lg p-3 border ${
            allHaveEnoughStock
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <div className="text-xs text-gray-500">Stock Status</div>
          <div
            className={`text-lg font-bold ${
              allHaveEnoughStock ? "text-green-700" : "text-red-700"
            }`}
          >
            {productsWithInventory.length === 0
              ? "—"
              : allHaveEnoughStock
              ? "✓ Sufficient"
              : "✗ Insufficient"}
          </div>
        </div>
      </div>

      {/* Product breakdown table */}
      <div className="overflow-x-auto">
        <table className="table w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500">
              <th>Part Number</th>
              <th className="text-center">Total Ordered</th>
              <th className="text-center">{pendingLabel}</th>
              <th className="text-center">Fulfilled</th>
              <th className="text-center">Remaining</th>
              <th className="text-center">On Hand</th>
              <th className="text-center">Available</th>
              <th className="text-center">Stock Status</th>
            </tr>
          </thead>
          <tbody>
            {productSummaries.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-gray-400 italic p-4">
                  No products found
                </td>
              </tr>
            ) : (
              productSummaries.map((product) => {
                const remaining = product.total_ordered - product.total_fulfilled;
                const enough = hasEnoughStock(product, orderType);
                return (
                  <tr key={product.product_id} className="hover:bg-gray-50">
                    <td className="font-semibold">{product.part_number}</td>
                    <td className="text-center">{product.total_ordered}</td>
                    <td className="text-center">{product.total_pending}</td>
                    <td className="text-center">{product.total_fulfilled}</td>
                    <td className="text-center">{remaining}</td>
                    <td className="text-center">
                      {product.on_hand !== null ? product.on_hand : "—"}
                    </td>
                    <td className="text-center">
                      {product.available !== null ? product.available : "—"}
                    </td>
                    <td className="text-center">
                      {product.on_hand === null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span
                          className={`badge badge-sm ${
                            enough ? "badge-success" : "badge-error"
                          }`}
                        >
                          {enough ? "✓" : "✗"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {productSummaries.length > 1 && (
            <tfoot>
              <tr className="font-semibold border-t-2 border-gray-300 bg-gray-50">
                <td>Totals</td>
                <td className="text-right">{totalOrdered}</td>
                <td className="text-right">
                  {productSummaries.reduce((s, p) => s + p.total_pending, 0)}
                </td>
                <td className="text-right">{totalFulfilled}</td>
                <td className="text-right">{totalOrdered - totalFulfilled}</td>
                <td className="text-right">—</td>
                <td className="text-right">—</td>
                <td className="text-center">
                  {productsWithInventory.length === 0 ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <span
                      className={`badge badge-sm ${
                        allHaveEnoughStock ? "badge-success" : "badge-error"
                      }`}
                    >
                      {allHaveEnoughStock ? "✓" : "✗"}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
