import React, { useLayoutEffect, useRef, useState } from "react";

interface MDTableProps {
  title: string;
  columns: string[];
  children: React.ReactNode;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  sortLabel?: string;
}


/** Build a compact list of page-number tokens including ellipsis. */
function buildPageTokens(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

export default function MDTable({
  title,
  columns,
  children,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  sortLabel,
}: MDTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollLeft = useRef(0);
  const savedScrollTop = useRef<number | null>(null);

  const [pageInput, setPageInput] = useState("");
  const [editing, setEditing] = useState(false);

  const pageTokens = buildPageTokens(page, totalPages);

  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollLeft = savedScrollLeft.current;
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
    if (el) savedScrollLeft.current = el.scrollLeft;
  };

  const handlePageChange = (newPage: number) => {
    const scrollParent = scrollContainerRef.current?.closest("main");
    if (scrollParent) savedScrollTop.current = scrollParent.scrollTop;
    onPageChange(newPage);
  };

  const commitPageInput = () => {
    const parsed = parseInt(pageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) handlePageChange(parsed);
    setEditing(false);
    setPageInput("");
  };

  // suppress unused title warning — kept for API compatibility
  void title;

  return (
    <div className="w-full mb-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Scrollable table area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-x-auto"
      >
        <table className="w-full border-collapse min-w-[700px]">
          {/* Column headers */}
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map((col, idx) => (
                <th
                  key={`${col}-${idx}`}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          {/* Data rows — zebra striping via nth-child */}
          <tbody className="divide-y divide-gray-100 [&>tr:nth-child(even)]:bg-gray-50/60">
            {children}
          </tbody>
        </table>

        {sortLabel && (
          <div className="px-4 py-1 text-xs text-gray-400 text-right border-t border-gray-100">
            Sorted by: {sortLabel}
          </div>
        )}
      </div>

      {/* ── Dark pagination dock ── */}
      <div className="flex items-center justify-between bg-gray-900 text-gray-400 px-4 py-2.5 text-xs gap-4 flex-wrap">
        {/* Left: rows per page */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-gray-500">Rows per page:</span>
          {onPageSizeChange ? (
            <input
              type="numeric"
              min={1}
              max={500}
              className="w-14 bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={pageSize}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= 500) {
                  onPageSizeChange(val);
                  handlePageChange(1);
                }
              }}
            />
          ) : (
            <span className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1">{pageSize}</span>
          )}
        </div>

        {/* Center: page numbers */}
        <div className="flex items-center gap-1">
          <button
            className="w-7 h-7 flex items-center justify-center rounded text-sm text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30 transition"
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
            aria-label="Previous page"
          >
            ‹
          </button>

          {pageTokens.map((token, idx) =>
            token === "…" ? (
              <span key={`ellipsis-${idx}`} className="px-1 text-gray-600 select-none">…</span>
            ) : editing && token === page ? (
              <input
                key={token}
                autoFocus
                type="number"
                min={1}
                max={totalPages}
                className="w-10 text-center bg-gray-800 border border-blue-500 rounded px-1 py-0.5 text-xs text-white focus:outline-none"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={commitPageInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitPageInput();
                  if (e.key === "Escape") { setEditing(false); setPageInput(""); }
                }}
              />
            ) : (
              <button
                key={token}
                onClick={() => {
                  if (token === page) { setPageInput(String(page)); setEditing(true); }
                  else handlePageChange(token as number);
                }}
                className={`w-7 h-7 flex items-center justify-center rounded text-xs transition ${
                  token === page
                    ? "bg-blue-600 text-white font-semibold"
                    : "text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
                title={token === page ? "Click to jump to a page" : undefined}
              >
                {token}
              </button>
            )
          )}

          <button
            className="w-7 h-7 flex items-center justify-center rounded text-sm text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30 transition"
            disabled={page >= totalPages}
            onClick={() => handlePageChange(page + 1)}
            aria-label="Next page"
          >
            ›
          </button>
        </div>

        {/* Right: result count */}
        <span className="shrink-0 text-gray-500">
          {total > 0 ? `Showing ${rangeStart}–${rangeEnd} of ${total}` : "No results"}
        </span>
      </div>
    </div>
  );
}
