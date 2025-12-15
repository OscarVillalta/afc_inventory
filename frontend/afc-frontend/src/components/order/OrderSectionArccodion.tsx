import OrderItemRow from "./OrderItemRow";
import type { OrderSection } from "../../mock/types"

interface Props {
  sections: OrderSection[];
}

export default function OrderSectionAccordion({ sections }: Props) {
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div
          key={section.id}
          className="collapse collapse-arrow bg-white rounded-xl shadow"
        >
          <input type="checkbox" />

          <div className="collapse-title text-lg font-semibold bg-sky-600 text-white">
            {section.title}
          </div>

          <div className="collapse-content">
            <table className="table w-full">
              <thead>
                <tr className="text-sm text-gray-500">
                  <th>Part Number</th>
                  <th>Qty Requested</th>
                  <th>Qty Fulfilled</th>
                  <th>Comment</th>
                  <th>Status</th>
                  <th>Completion Date</th>
                </tr>
              </thead>

              <tbody>
                {section.items.map((item) => (
                    <OrderItemRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}