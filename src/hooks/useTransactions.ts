import { useEffect, useMemo, useState } from 'react';
import type {
  MerchantCategory,
  Transaction,
  TransactionInput,
  TransactionStatus,
  TransactionType,
} from '../types';

export type StatusFilter = TransactionStatus | 'all';
export type TypeFilter = TransactionType | 'all';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

/** Canonical options for transaction status, used in forms. */
export const STATUS_OPTIONS: ReadonlyArray<SelectOption<TransactionStatus>> = [
  { value: 'pending', label: 'Pending' },
  { value: 'posted', label: 'Posted' },
  { value: 'declined', label: 'Declined' },
];

/** Canonical options for transaction type, used in forms. */
export const TYPE_OPTIONS: ReadonlyArray<SelectOption<TransactionType>> = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'refund', label: 'Refund' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'fee', label: 'Fee' },
  { value: 'interest', label: 'Interest' },
];

/** Canonical options for merchant category, used in forms. */
export const MERCHANT_CATEGORY_OPTIONS: ReadonlyArray<
  SelectOption<MerchantCategory>
> = [
  { value: 'groceries', label: 'Groceries' },
  { value: 'travel', label: 'Travel' },
  { value: 'dining', label: 'Dining' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'health', label: 'Health' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'income', label: 'Income' },
  { value: 'fees', label: 'Fees' },
];

/** Filter options include an "All" sentinel value that disables the filter. */
export const STATUS_FILTER_OPTIONS: ReadonlyArray<SelectOption<StatusFilter>> =
  [{ value: 'all', label: 'All statuses' }, ...STATUS_OPTIONS];

export const TYPE_FILTER_OPTIONS: ReadonlyArray<SelectOption<TypeFilter>> = [
  { value: 'all', label: 'All types' },
  ...TYPE_OPTIONS,
];

export interface UseTransactions {
  /** The full account, unfiltered. */
  transactions: Transaction[];
  /** Rows that match the current search query + active filters. */
  results: Transaction[];
  /** Current value of the search box. */
  query: string;
  /** Update the search query. */
  onSearch: (value: string) => void;
  /** Current status filter (`'all'` = no filter). */
  statusFilter: StatusFilter;
  /** Update the status filter. */
  onStatusFilterChange: (value: StatusFilter) => void;
  /** Current type filter (`'all'` = no filter). */
  typeFilter: TypeFilter;
  /** Update the type filter. */
  onTypeFilterChange: (value: TypeFilter) => void;
  /** Insert a new transaction. Resolves with the server-assigned row. */
  createTransaction: (input: TransactionInput) => Promise<Transaction>;
  /** Replace an existing transaction (matched by id) via `PUT`. */
  updateTransaction: (transaction: Transaction) => Promise<void>;
  /** Remove a transaction by id via `DELETE`. */
  deleteTransaction: (id: string) => Promise<void>;
}

/**
 * Owns the account's transactions, the description search, the status/type
 * filters, and the CRUD mutations.
 *
 * The search term is debounced so we don't re-filter on every keystroke;
 * dropdown filters apply immediately, as do mutations.
 */
export function useTransactions(): UseTransactions {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  useEffect(() => {
    let active = true;
    fetch('/api/transactions')
      .then((res) => res.json())
      .then((data: Transaction[]) => {
        if (!active) return;
        setTransactions(data);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Client-side filtering against the cached list, so search and dropdowns
  // remain snappy without a refetch per keystroke. The backend supports the
  // same filters as query params (`?status=`, `?type=`, `?q=`) for other
  // callers (curl, tests, etc.).
  const results = useMemo(() => {
    const term = debouncedQuery.trim().toLowerCase();
    return transactions.filter((t) => {
      if (term && !t.description.toLowerCase().includes(term)) {
        return false;
      }
      if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false;
      }
      if (typeFilter !== 'all' && t.type !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [transactions, debouncedQuery, statusFilter, typeFilter]);

  const createTransaction = async (
    input: TransactionInput,
  ): Promise<Transaction> => {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw await toApiError(res, 'Create failed');
    const created: Transaction = await res.json();
    setTransactions((prev) => [created, ...prev]);
    return created;
  };

  const updateTransaction = async (transaction: Transaction): Promise<void> => {
    const { id, ...input } = transaction;
    const res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw await toApiError(res, 'Update failed');
    const updated: Transaction = await res.json();
    setTransactions((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t)),
    );
  };

  const deleteTransaction = async (id: string): Promise<void> => {
    const res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw await toApiError(res, 'Delete failed');
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  return {
    transactions,
    results,
    query,
    onSearch: setQuery,
    statusFilter,
    onStatusFilterChange: setStatusFilter,
    typeFilter,
    onTypeFilterChange: setTypeFilter,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
}

/** Turn a non-OK fetch response into an Error using the server's `{ error }` body when present. */
async function toApiError(res: Response, fallback: string): Promise<Error> {
  const body: unknown = await res.json().catch(() => null);
  const message =
    body &&
    typeof body === 'object' &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'string'
      ? (body as { error: string }).error
      : `${fallback} (HTTP ${res.status}).`;
  return new Error(message);
}
