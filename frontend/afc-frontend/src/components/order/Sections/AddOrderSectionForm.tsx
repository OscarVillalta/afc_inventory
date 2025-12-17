import { useState } from "react";
import { createOrderSection } from "../../../api/orderDetail";

export default function AddOrderSectionForm({
  orderId,
  onCreated,
}: {
  orderId: number;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;

    setLoading(true);
    await createOrderSection({
      order_id: orderId,
      title,
      description: description || undefined,
    });

    setTitle("");
    setDescription("");
    setOpen(false);
    setLoading(false);
    onCreated();
  }

  if (!open) {
    return (
      <button
        className="btn btn-sm btn-outline"
        onClick={() => setOpen(true)}
      >
        + New Section
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-white shadow-sm border p-4 space-y-3">
      <input
        className="input input-sm input-bordered w-full"
        placeholder="Section title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        className="input input-sm input-bordered w-full"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <button
          className="btn btn-sm btn-outline"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button
          className="btn btn-sm btn-primary"
          onClick={handleCreate}
          disabled={loading}
        >
          Create
        </button>
      </div>
    </div>
  );
}
