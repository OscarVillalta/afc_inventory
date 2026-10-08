import { Component, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError } from "../../api/apiClient";
import {
  fetchInventoryValue,
  formatInventoryMoney,
  type InventoryValue,
  type InventoryValueGroup,
} from "../../api/inventoryValue";
import type { Supplier } from "../../api/suppliers";

type ValueView = "total" | "provider" | "product";

const VIEWS: { key: ValueView; label: string }[] = [
  { key: "total", label: "Complete total" },
  { key: "provider", label: "Per provider" },
  { key: "product", label: "Per product" },
];

interface Props {
  refreshToken?: number;
  suppliers?: Supplier[];
}

class InventoryValueBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 border-t-4 border-emerald-500 px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Inventory value</p>
          <p className="text-sm text-gray-500 mt-2">
            This total could not be shown. The rest of inventory is still available.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function isAccessDenied(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

function unpricedMessage(count: number | null): string | null {
  if (count == null || !Number.isFinite(count) || count <= 0) return null;
  const n = Math.trunc(count);
  const noun = n === 1 ? "item has stock but no unit price" : "items have stock but no unit price";
  const pronoun = n === 1 ? "it is" : "they are";
  return `${n.toLocaleString("en-US")} ${noun}, so ${pronoun} left out of this total.`;
}

export default function InventoryValueCard(props: Props) {
  return (
    <InventoryValueBoundary>
      <InventoryValueCardBody {...props} />
    </InventoryValueBoundary>
  );
}

function InventoryValueCardBody({ refreshToken = 0, suppliers = [] }: Props) {
  const providerFieldId = useId();
  const productFieldId = useId();
  const pickerRef = useRef<HTMLDivElement>(null);

  const [hidden, setHidden] = useState(false);
  const [view, setView] = useState<ValueView>("total");
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [productId, setProductId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const [headerResult, setHeaderResult] = useState<{ key: string; data: InventoryValue | null; error: boolean } | null>(null);
  const [providerResult, setProviderResult] = useState<{
    key: string;
    groups: InventoryValueGroup[];
    truncated: boolean;
    error: boolean;
  } | null>(null);
  const [productResult, setProductResult] = useState<{
    key: string;
    groups: InventoryValueGroup[];
    truncated: boolean;
    error: boolean;
  } | null>(null);

  const providers = useMemo(() => {
    if (!Array.isArray(suppliers)) return [];
    return suppliers
      .filter(
        (supplier): supplier is Supplier =>
          !!supplier &&
          typeof supplier.id === "number" &&
          Number.isInteger(supplier.id) &&
          supplier.id > 0 &&
          typeof supplier.name === "string" &&
          supplier.name.length > 0,
      )
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers]);

  const selectedProvider = providers.find((supplier) => supplier.id === supplierId) ?? null;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(productSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [productSearch]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const headerKey = `${supplierId}|${productId ?? ""}|${refreshToken}`;
  const header = headerResult?.key === headerKey ? headerResult.data : null;
  const headerLoading = headerResult?.key !== headerKey;
  const headerError = headerResult?.key === headerKey && headerResult.error;

  useEffect(() => {
    let cancelled = false;
    fetchInventoryValue({
      supplierId: supplierId === "" ? null : supplierId,
      productId,
    })
      .then((data) => {
        if (!cancelled) setHeaderResult({ key: headerKey, data, error: false });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isAccessDenied(err)) {
          setHidden(true);
          return;
        }
        setHeaderResult({ key: headerKey, data: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [headerKey, supplierId, productId]);

  const providerKey = `${productId ?? ""}|${refreshToken}`;
  const providerCurrent = providerResult?.key === providerKey ? providerResult : null;
  const providerGroups = view === "provider" && providerCurrent ? providerCurrent.groups : [];
  const providerTruncated = providerCurrent?.truncated ?? false;
  const providerLoading = view === "provider" && !providerCurrent;
  const providerError = providerCurrent?.error ?? false;

  useEffect(() => {
    if (view !== "provider") return;
    let cancelled = false;
    fetchInventoryValue({
      productId,
      groupBy: "supplier",
      limit: 100,
    })
      .then((data) => {
        if (!cancelled) {
          setProviderResult({
            key: providerKey,
            groups: data.groups,
            truncated: data.groups_truncated,
            error: false,
          });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isAccessDenied(err)) {
          setHidden(true);
          return;
        }
        setProviderResult({ key: providerKey, groups: [], truncated: false, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [view, providerKey, productId]);

  const loadProductList = view === "product" || menuOpen;
  const productKey = `${supplierId}|${debouncedSearch}|${refreshToken}`;
  const productCurrent = productResult?.key === productKey ? productResult : null;
  const productGroups = loadProductList && productCurrent ? productCurrent.groups : [];
  const productTruncated = productCurrent?.truncated ?? false;
  const productLoading = loadProductList && !productCurrent;
  const productError = productCurrent?.error ?? false;

  useEffect(() => {
    if (!loadProductList) return;
    let cancelled = false;
    fetchInventoryValue({
      supplierId: supplierId === "" ? null : supplierId,
      groupBy: "product",
      q: debouncedSearch,
      limit: 100,
    })
      .then((data) => {
        if (!cancelled) {
          setProductResult({
            key: productKey,
            groups: data.groups,
            truncated: data.groups_truncated,
            error: false,
          });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isAccessDenied(err)) {
          setHidden(true);
          return;
        }
        setProductResult({ key: productKey, groups: [], truncated: false, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [loadProductList, productKey, supplierId, debouncedSearch]);

  function selectProvider(next: string) {
    if (next === "") {
      setSupplierId("");
    } else {
      const id = Number(next);
      if (!Number.isInteger(id) || id < 1) return;
      setSupplierId(id);
    }
    setProductId(null);
    setProductSearch("");
    setMenuOpen(false);
  }

  function selectProduct(group: InventoryValueGroup) {
    if (!group.product_id) return;
    setProductId(group.product_id);
    setProductSearch(group.product_name ?? `Product ${group.product_id}`);
    setMenuOpen(false);
  }

  function clearProduct() {
    setProductId(null);
    setProductSearch("");
    setMenuOpen(false);
  }

  const scopeLabel = productId
    ? productSearch || "Selected product"
    : selectedProvider
      ? selectedProvider.name
      : "All on-hand inventory";

  const unpriced = unpricedMessage(header?.unpriced_skus ?? null);
  const showProductMenu = menuOpen && view !== "product" && !header?.restricted;

  if (hidden || header?.restricted) return null;

  return (
    <div className="relative z-10 bg-white rounded-lg shadow-sm border border-gray-100 overflow-visible border-t-4 border-emerald-500">
      <div className="px-5 py-4 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Inventory value</p>
            {headerLoading && !header ? (
              <div className="mt-2 h-9 w-40 rounded bg-gray-100 animate-pulse" />
            ) : header?.restricted ? (
              <p className="mt-2 text-sm text-gray-500">Pricing is not available for this account.</p>
            ) : headerError ? (
              <p className="mt-2 text-sm text-gray-500">
                Inventory value is unavailable right now. The rest of this page is unchanged.
              </p>
            ) : (
              <p className={`text-3xl font-bold text-emerald-700 ${headerLoading ? "opacity-60" : ""}`}>
                {formatInventoryMoney(header?.gross_total)}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {scopeLabel} · sum of on-hand × unit price
              {header && !header.restricted && header.on_hand_units != null
                ? ` · ${header.on_hand_units.toLocaleString("en-US")} units`
                : ""}
            </p>
            {unpriced && !headerError && !header?.restricted && (
              <p className="text-xs text-amber-700 mt-1">{unpriced}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {VIEWS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setView(option.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  view === option.key
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-0.5 min-w-[180px] sm:w-64">
            <label htmlFor={providerFieldId} className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Provider
            </label>
            <select
              id={providerFieldId}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={supplierId === "" ? "" : String(supplierId)}
              onChange={(event) => selectProvider(event.target.value)}
            >
              <option value="">All providers</option>
              {providers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-0.5 min-w-[220px] flex-1" ref={pickerRef}>
            <label htmlFor={productFieldId} className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Product
            </label>
            <div className="relative">
              <input
                id={productFieldId}
                type="text"
                autoComplete="off"
                className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                  productId != null ? "pr-14" : ""
                }`}
                placeholder="Search by part number or name"
                value={productSearch}
                onChange={(event) => {
                  setProductSearch(event.target.value);
                  setProductId(null);
                  setMenuOpen(true);
                }}
                onFocus={() => setMenuOpen(true)}
              />
              {productId != null && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-emerald-700 hover:text-emerald-900"
                  onClick={clearProduct}
                >
                  Clear
                </button>
              )}
              {showProductMenu && (
                <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  <GroupList
                    groups={productGroups}
                    loading={productLoading}
                    error={productError}
                    truncated={productTruncated}
                    selectedProductId={productId}
                    emptyLabel={debouncedSearch ? "No matching products." : "No priced inventory to show."}
                    onSelect={selectProduct}
                    mode="product"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {view === "provider" && !header?.restricted && (
          <Breakdown
            title="Value by provider"
            loading={providerLoading}
            error={providerError}
          >
            <GroupList
              groups={providerGroups}
              loading={providerLoading}
              error={providerError}
              truncated={providerTruncated}
              selectedSupplierId={supplierId === "" ? null : supplierId}
              emptyLabel="No inventory value for this filter."
              onSelect={(group) => {
                if (!group.supplier_id) return;
                selectProvider(String(group.supplier_id));
              }}
              mode="provider"
            />
          </Breakdown>
        )}

        {view === "product" && !header?.restricted && (
          <Breakdown title="Value by product" loading={productLoading} error={productError}>
            <GroupList
              groups={productGroups}
              loading={productLoading}
              error={productError}
              truncated={productTruncated}
              selectedProductId={productId}
              emptyLabel={debouncedSearch ? "No matching products." : "No inventory value for this filter."}
              onSelect={selectProduct}
              mode="product"
            />
          </Breakdown>
        )}
      </div>
    </div>
  );
}

function Breakdown({
  title,
  loading,
  error,
  children,
}: {
  title: string;
  loading: boolean;
  error: boolean;
  children: ReactNode;
}) {
  return (
    <div className="border border-gray-100 rounded-lg">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
        {loading && !error && <p className="text-xs text-gray-400">Loading…</p>}
      </div>
      {children}
    </div>
  );
}

function GroupList({
  groups,
  loading,
  error,
  truncated,
  selectedProductId = null,
  selectedSupplierId = null,
  emptyLabel,
  onSelect,
  mode,
}: {
  groups: InventoryValueGroup[];
  loading: boolean;
  error: boolean;
  truncated: boolean;
  selectedProductId?: number | null;
  selectedSupplierId?: number | null;
  emptyLabel: string;
  onSelect: (group: InventoryValueGroup) => void;
  mode: "provider" | "product";
}) {
  if (error) {
    return <p className="px-3 py-3 text-sm text-gray-500">Could not load this breakdown.</p>;
  }
  if (!groups.length) {
    return (
      <p className="px-3 py-3 text-sm text-gray-500">
        {loading ? "Loading…" : emptyLabel}
      </p>
    );
  }
  return (
    <div className="max-h-72 overflow-y-auto">
      {groups.map((group, index) => {
        const key = mode === "provider"
          ? `supplier-${group.supplier_id ?? "unknown"}-${index}`
          : `product-${group.product_id ?? "unknown"}-${index}`;
        const selected = mode === "provider"
          ? group.supplier_id != null && group.supplier_id === selectedSupplierId
          : group.product_id != null && group.product_id === selectedProductId;
        const title = mode === "provider"
          ? group.supplier_name || "Unknown provider"
          : group.product_name || "Unnamed product";
        const detail = mode === "product"
          ? [
              group.supplier_name || "Unknown provider",
              group.unit_price != null ? `${formatInventoryMoney(group.unit_price)} each` : "No unit price",
              `${Math.trunc(group.on_hand_units).toLocaleString("en-US")} on hand`,
            ].join(" · ")
          : `${Math.trunc(group.sku_count).toLocaleString("en-US")} ${group.sku_count === 1 ? "item" : "items"} · ${Math.trunc(group.on_hand_units).toLocaleString("en-US")} on hand`;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(group)}
            className={`w-full text-left px-3 py-2 border-b border-gray-50 last:border-b-0 hover:bg-emerald-50 ${
              selected ? "bg-emerald-50" : "bg-white"
            }`}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-800 truncate" title={title}>
                  {title}
                </span>
                <span className="block text-xs text-gray-400 truncate">{detail}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-gray-800">
                {formatInventoryMoney(group.gross_total)}
              </span>
            </span>
          </button>
        );
      })}
      {truncated && (
        <p className="px-3 py-2 text-xs text-gray-400">Showing the highest values. Search to narrow the list.</p>
      )}
    </div>
  );
}
