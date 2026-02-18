import React, { useLayoutEffect, useRef } from "react";

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollLeft = useRef(0);
  const savedScrollTop = useRef<number | null>(null);

  // Restore scroll positions after re-render
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollLeft = savedScrollLeft.current;
    }
    // Restore the parent scrollable container's vertical scroll position
    if (savedScrollTop.current !== null) {
      const scrollParent = scrollContainerRef.current?.closest("main");
      if (scrollParent) {
        scrollParent.scrollTop = savedScrollTop.current;
        savedScrollTop.current = null;
      }
    }
  });

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (el) {
      savedScrollLeft.current = el.scrollLeft;
    }
  };

  const handlePageChange = (newPage: number) => {
    // Save the parent's vertical scroll position before page change triggers re-render
    const scrollParent = scrollContainerRef.current?.closest("main");
    if (scrollParent) {
      savedScrollTop.current = scrollParent.scrollTop;
    }
    onPageChange(newPage);
  };

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
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="bg-white rounded-2xl shadow-md p-6 border border-gray-100 pt-12 overflow-x-auto"
      >
        <table className="w-full border-separate border-spacing-y-2 border-separate min-w-[700px]">
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
            onClick={() => handlePageChange(page - 1)}
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
                onClick={() => handlePageChange(p)}
              >
                {p}
              </button>
            );
          })}

          {/* Next Button */}
          <button
            className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-200 hover:bg-gray-300 disabled:opacity-40"
            disabled={page === totalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
