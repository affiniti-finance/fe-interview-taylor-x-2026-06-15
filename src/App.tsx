import { useState } from 'react';
import { AccountSummary } from './components/AccountSummary';
import { FilterSelect } from './components/FilterSelect';
import { SearchBar } from './components/SearchBar';
import {
  TransactionDetail,
  type TransactionDetailMode,
} from './components/TransactionDetail';
import { TransactionList } from './components/TransactionList';
import {
  STATUS_FILTER_OPTIONS,
  TYPE_FILTER_OPTIONS,
  useTransactions,
} from './hooks/useTransactions';
import type { Transaction, TransactionInput } from './types';

type PanelState =
  | { mode: 'closed' }
  | { mode: 'view'; transaction: Transaction }
  | { mode: 'edit'; transaction: Transaction }
  | { mode: 'create' };

export default function App() {
  const {
    transactions,
    results,
    query,
    onSearch,
    statusFilter,
    onStatusFilterChange,
    typeFilter,
    onTypeFilterChange,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  } = useTransactions();

  const [panel, setPanel] = useState<PanelState>({ mode: 'closed' });

  const selectedId =
    panel.mode === 'view' || panel.mode === 'edit' ? panel.transaction.id : null;

  function handleSelect(transaction: Transaction) {
    setPanel({ mode: 'view', transaction });
  }

  function handleNewTransaction() {
    setPanel({ mode: 'create' });
  }

  function handleClosePanel() {
    setPanel({ mode: 'closed' });
  }

  function handleEditClick() {
    if (panel.mode === 'view') {
      setPanel({ mode: 'edit', transaction: panel.transaction });
    }
  }

  function handleCancelEdit() {
    // Cancelling an edit returns to view; cancelling a create closes the panel.
    if (panel.mode === 'edit') {
      setPanel({ mode: 'view', transaction: panel.transaction });
    } else {
      setPanel({ mode: 'closed' });
    }
  }

  async function handleSave(input: TransactionInput) {
    try {
      if (panel.mode === 'edit') {
        const updated: Transaction = { id: panel.transaction.id, ...input };
        await updateTransaction(updated);
        setPanel({ mode: 'view', transaction: updated });
      } else if (panel.mode === 'create') {
        const created = await createTransaction(input);
        setPanel({ mode: 'view', transaction: created });
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Save failed.');
    }
  }

  async function handleDelete() {
    if (panel.mode !== 'view' && panel.mode !== 'edit') return;
    try {
      await deleteTransaction(panel.transaction.id);
      setPanel({ mode: 'closed' });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  // Key the panel by (mode + transaction id) so internal form state resets
  // when the user switches between transactions or modes.
  const panelKey =
    panel.mode === 'closed'
      ? null
      : `${panel.mode}-${panel.mode === 'create' ? 'new' : panel.transaction.id}`;

  const panelMode: TransactionDetailMode | null =
    panel.mode === 'closed' ? null : panel.mode;

  const panelTransaction =
    panel.mode === 'view' || panel.mode === 'edit' ? panel.transaction : null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Account Transactions</h1>
        <p className="account-meta">Account acct_8842 · USD</p>
      </header>

      <AccountSummary transactions={transactions} />

      <div className="toolbar">
        <SearchBar value={query} onChange={onSearch} />
        <FilterSelect
          label="Status"
          value={statusFilter}
          options={STATUS_FILTER_OPTIONS}
          onChange={onStatusFilterChange}
        />
        <FilterSelect
          label="Type"
          value={typeFilter}
          options={TYPE_FILTER_OPTIONS}
          onChange={onTypeFilterChange}
        />
        <button
          type="button"
          className="button button--primary"
          onClick={handleNewTransaction}
        >
          New transaction
        </button>
        <span className="result-count">{results.length} shown</span>
      </div>

      <div className="content">
        <TransactionList
          transactions={results}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
        {panelMode && (
          <TransactionDetail
            key={panelKey ?? undefined}
            mode={panelMode}
            transaction={panelTransaction}
            onClose={handleClosePanel}
            onEdit={handleEditClick}
            onCancelEdit={handleCancelEdit}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );
}
