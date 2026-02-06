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
        <table className="w-full border-separate border-spacing-y-2 border-separate">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="text-center text-gray-600 font-bold text-m uppercase tracking-wide"
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
          {[...Array(totalPages)].map((_, i) => {
            const p = i + 1;
            const active = p === page;

            return (
              <button
                key={p}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition 
                  ${
                    active
                      ? "bg-[#3A7BD5] text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            );
          })}

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
