import React from "react";

interface MDTableProps {
  title: string;
  columns: string[];
  children: React.ReactNode;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function MDTable({
  title,
  columns,
  children,
  page,
  pageSize,
  total,
  onPageChange,
}: MDTableProps) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="relative w-full mb-12">
      {/* Floating Header Card */}
      <div
        className="
          absolute -top-6 left-6 right-6 
          rounded-xl shadow-lg 
          text-white font-semibold text-lg 
          px-6 py-4
        "
        style={{
          background: "linear-gradient(90deg, #3A7BD5 0%, #2B60C8 100%)",
        }}
      >
        {title}
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100 pt-12">
        <table className="w-full border-separate border-spacing-y-2">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="text-left text-gray-600 font-semibold pb-3 text-sm uppercase tracking-wide"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="text-gray-800">{children}</tbody>
        </table>

        {/* Pagination */}
        <div className="flex justify-center items-center gap-2 mt-6">
          {/* Prev Button */}
          <button
            className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-200 hover:bg-gray-300 disabled:opacity-40"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >
            Prev
          </button>

          {/* Page Numbers */}
          {(() => {
            const firstGroup = Array.from(
              { length: Math.max(0, Math.min(5, totalPages - page + 1)) },
              (_, i) => page + i
            );

            const lastGroupStart = Math.max(totalPages - 4, 1);
            const lastGroup = Array.from(
              { length: Math.max(0, Math.min(5, totalPages - lastGroupStart + 1)) },
              (_, i) => lastGroupStart + i
            );

            const allPages = [
              ...new Set([...firstGroup, ...lastGroup]),
            ].sort((a, b) => a - b);

            const items: (number | "ellipsis")[] = [];
            for (let i = 0; i < allPages.length; i++) {
              items.push(allPages[i]);
              if (
                i < allPages.length - 1 &&
                allPages[i + 1] - allPages[i] > 1
              ) {
                items.push("ellipsis");
              }
            }

            return items.map((item, idx) => {
              if (item === "ellipsis") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 py-2 text-sm text-gray-500"
                  >
                    …
                  </span>
                );
              }
              const active = item === page;
              return (
                <button
                  key={item}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition 
                    ${
                      active
                        ? "bg-[#3A7BD5] text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </button>
              );
            });
          })()}

          {/* Next Button */}
          <button
            className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-200 hover:bg-gray-300 disabled:opacity-40"
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
