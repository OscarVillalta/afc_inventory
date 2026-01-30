interface LineItemsMenuProps {
  partNumberFilter: string;
  setPartNumberFilter: (value: string) => void;
  sectionFilter: string;
  setSectionFilter: (value: string) => void;
  descriptionFilter: string;
  setDescriptionFilter: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  itemsPerPage: number;
  setItemsPerPage: (value: number) => void;
  totalItems: number;
}

export default function LineItemsMenu({
  partNumberFilter,
  setPartNumberFilter,
  sectionFilter,
  setSectionFilter,
  descriptionFilter,
  setDescriptionFilter,
  statusFilter,
  setStatusFilter,
  currentPage,
  setCurrentPage,
  totalPages,
  itemsPerPage,
  setItemsPerPage,
  totalItems,
}: LineItemsMenuProps) {
  return (
    <div className="bg-white border rounded-lg p-4 mb-4 space-y-3">
      {/* Search and Filter Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Part Number Search */}
        <div>
          <label htmlFor="part-number-filter" className="text-xs text-gray-500 mb-1 block">Part Number</label>
          <input
            id="part-number-filter"
            type="text"
            placeholder="Search part number..."
            className="input input-sm input-bordered w-full"
            value={partNumberFilter}
            onChange={(e) => {
              setPartNumberFilter(e.target.value);
              setCurrentPage(1); // Reset to first page on filter change
            }}
            aria-label="Search by part number"
          />
        </div>

        {/* Section Search */}
        <div>
          <label htmlFor="section-filter" className="text-xs text-gray-500 mb-1 block">Section</label>
          <input
            id="section-filter"
            type="text"
            placeholder="Search section..."
            className="input input-sm input-bordered w-full"
            value={sectionFilter}
            onChange={(e) => {
              setSectionFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Search by section"
          />
        </div>

        {/* Description Search */}
        <div>
          <label htmlFor="description-filter" className="text-xs text-gray-500 mb-1 block">Description</label>
          <input
            id="description-filter"
            type="text"
            placeholder="Search description..."
            className="input input-sm input-bordered w-full"
            value={descriptionFilter}
            onChange={(e) => {
              setDescriptionFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Search by description"
          />
        </div>

        {/* Status Dropdown */}
        <div>
          <label htmlFor="status-filter" className="text-xs text-gray-500 mb-1 block">Status</label>
          <select
            id="status-filter"
            className="select select-sm select-bordered w-full"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by status"
          >
            <option value="">All </option>
            <option value="Pending">Pending</option>
            <option value="Partially Fulfilled">Partially Fulfilled</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Pagination Row */}
      <div className="flex items-end justify-between border-t pt-3">

        {/* Pagination Controls */}
        <div className="flex grow-32 justify-center gap-2">
          <button
            className="btn btn-sm btn-outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            aria-label="Go to previous page"
          >
            Previous
          </button>
          
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                // Show first page, last page, current page, and pages around current
                if (page === 1 || page === totalPages) return true;
                if (Math.abs(page - currentPage) <= 1) return true;
                return false;
              })
              .map((page, idx, arr) => {
                // Add ellipsis
                const prevPage = arr[idx - 1];
                const showEllipsis = prevPage && page - prevPage > 1;

                return (
                  <div key={page} className="flex items-center gap-1">
                    {showEllipsis && (
                      <span className="px-2 text-gray-400" aria-hidden="true">...</span>
                    )}
                    <button
                      className={`btn btn-sm ${
                        currentPage === page ? "btn-primary" : "btn-outline"
                      }`}
                      onClick={() => setCurrentPage(page)}
                      aria-label={`Go to page ${page}`}
                      aria-current={currentPage === page ? "page" : undefined}
                    >
                      {page}
                    </button>
                  </div>
                );
              })}
          </div>

          <button
            className="btn btn-sm btn-outline"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(currentPage + 1)}
            aria-label="Go to next page"
          >
            Next
          </button>
        </div>

        <div className="flex flex-col grow-0 items-center gap-2">

          <span className="text-[0.75rem] text-gray-500">
            Showing {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} -{" "}
            {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
          </span>

          <select
            className="select select-xs select-bordered"
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

      </div>
    </div>
  );
}
