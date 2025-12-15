import React, { useMemo, useState } from "react";
import MainLayout from "../../layouts/MainLayout";
import OrderHeader from "./OrderHeader";
import OrderMetaCard from "./OrderMetaCard";
import OrderDescription from "./OrderDescription";
import OrderSectionAccordion from "./OrderSectionArccodion";
import { mockOrderSections } from "../../mock/orders";

export default function OrderDetailPage() {

  const [description, setDescription] = useState(
    "Filter replenishment order for AHU inventory restock. Please prioritize V-Banks and Pocket filters."
  );


  return (
    <MainLayout>
      <div className="flex justify-start flex-grow gap-x-4">
        <div className="max-w-7xl space-y-4 flex-3 bg-slate-100">
          <OrderHeader/>
            <div className="lg:col-span-8 space-y-4">
              <OrderMetaCard/>
              
              <OrderSectionAccordion sections={mockOrderSections} />
            </div>
        </div>

        <div className="flex-1">
          <OrderDescription value={description} onChange={setDescription}/>
        </div>
        
      </div>
      
    </MainLayout>
  );
}
