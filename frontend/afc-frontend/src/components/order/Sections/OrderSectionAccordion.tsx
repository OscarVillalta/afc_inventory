import { useEffect, useState } from "react";
import type { OrderSectionPayload } from "../../../api/orderDetail";
import type { Product } from "../../../api/products";
import { fetchProducts } from "../../../api/products";
import OrderSectionCard from "./OrderSectionCard";
import AddOrderSectionForm from "./AddOrderSectionForm";

interface Props {
  orderId: number;
  orderStatus: string;
  sections: OrderSectionPayload[];
  onRefresh: () => void;
  orderType: "incoming" | "outgoing";
}

export default function OrderSectionAccordion({
  orderId,
  sections,
  onRefresh,
  orderType,
  orderStatus,
}: Props) {
  const [products, setProducts] = useState<Product[]>([]);

  const isCompleted = orderStatus === "Completed";

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => console.error("Failed to load products"));
  }, []);

  return (
    <div className="space-y-4">
      {/* Add Section ONLY if order is NOT completed */}
      {!isCompleted && (
        <AddOrderSectionForm
          orderId={orderId}
          onCreated={onRefresh}
        />
      )}

      {sections.map((section) => (
        <OrderSectionCard
          key={section.id}
          section={section}
          orderId={orderId}
          orderType={orderType}
          products={products}
          onRefresh={onRefresh}
          orderStatus={orderStatus}
        />
      ))}
    </div>
  );
}
