import { useState, type FormEvent } from 'react';
import {
  MERCHANT_CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
} from '../hooks/useTransactions';
import { formatCents } from '../lib/money';
import type {
  MerchantCategory,
  Transaction,
  TransactionInput,
  TransactionStatus,
  TransactionType,
} from '../types';

export type TransactionDetailMode = 'view' | 'edit' | 'create';

interface TransactionDetailProps {
  mode: TransactionDetailMode;
  /** The transaction being viewed/edited. `null` in create mode. */
  transaction: Transaction | null;
  onClose: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (input: TransactionInput) => void;
  onDelete: () => void;
}

export function TransactionDetail(props: TransactionDetailProps) {
  if (props.mode === 'view' && props.transaction) {
    return <ViewMode {...props} transaction={props.transaction} />;
  }
  return <FormMode {...props} />;
}

function ViewMode({
  transaction,
  onClose,
  onEdit,
  onDelete,
}: TransactionDetailProps & { transaction: Transaction }) {
  function handleDelete() {
    if (
      window.confirm(
        `Delete "${transaction.description}"? This cannot be undone.`,
      )
    ) {
      onDelete();
    }
  }

  return (
    <aside className="txn-detail" aria-label="Transaction detail">
      <div className="txn-detail-header">
        <h2>Transaction detail</h2>
        <button type="button" className="close-button" onClick={onClose}>
          Close
        </button>
      </div>

      <dl className="txn-detail-grid">
        <dt>Description</dt>
        <dd>{transaction.description}</dd>

        <dt>Amount</dt>
        <dd>{formatCents(transaction.amountCents, transaction.currency)}</dd>

        <dt>Status</dt>
        <dd>{transaction.status}</dd>

        <dt>Type</dt>
        <dd>{transaction.type}</dd>

        <dt>Category</dt>
        <dd>{transaction.merchantCategory}</dd>

        <dt>Currency</dt>
        <dd>{transaction.currency}</dd>

        <dt>Date</dt>
        <dd>{formatDateTime(transaction.createdAt)}</dd>

        <dt>ID</dt>
        <dd className="txn-detail-id">{transaction.id}</dd>
      </dl>

      <div className="txn-detail-actions">
        <button
          type="button"
          className="button button--primary"
          onClick={onEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="button button--danger"
          onClick={handleDelete}
        >
          Delete
        </button>
      </div>
    </aside>
  );
}

function FormMode({
  mode,
  transaction,
  onCancelEdit,
  onSave,
}: TransactionDetailProps) {
  const initial: TransactionInput = transaction
    ? inputFromTransaction(transaction)
    : defaultInput();

  const [description, setDescription] = useState(initial.description);
  const [amountInput, setAmountInput] = useState(
    centsToInputString(initial.amountCents),
  );
  const [status, setStatus] = useState<TransactionStatus>(initial.status);
  const [type, setType] = useState<TransactionType>(initial.type);
  const [category, setCategory] = useState<MerchantCategory>(
    initial.merchantCategory,
  );
  const [createdAtInput, setCreatedAtInput] = useState(
    isoToLocalDatetimeInput(initial.createdAt),
  );

  const isCreate = mode === 'create';
  const heading = isCreate ? 'New transaction' : 'Edit transaction';
  const submitLabel = isCreate ? 'Create' : 'Save';

  const amountValidation = validateAmount(amountInput);
  const amountError = amountValidation.ok ? null : amountValidation.error;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!amountValidation.ok) return;
    onSave({
      description: description.trim(),
      amountCents: amountValidation.cents,
      currency: initial.currency,
      status,
      type,
      merchantCategory: category,
      createdAt: localDatetimeInputToIso(createdAtInput),
    });
  }

  return (
    <aside className="txn-detail" aria-label={heading}>
      <div className="txn-detail-header">
        <h2>{heading}</h2>
        <button
          type="button"
          className="close-button"
          onClick={onCancelEdit}
        >
          Cancel
        </button>
      </div>

      <form className="txn-form" onSubmit={handleSubmit}>
        <label className="txn-form-field">
          <span>Description</span>
          <input
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            maxLength={120}
          />
        </label>

        <label className="txn-form-field">
          <span>Amount ({initial.currency})</span>
          <input
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            required
            aria-invalid={amountError !== null}
            aria-describedby={
              amountError ? 'amount-error' : 'amount-hint'
            }
          />
          {amountError ? (
            <small
              id="amount-error"
              className="txn-form-error"
              role="alert"
            >
              {amountError}
            </small>
          ) : (
            <small id="amount-hint" className="txn-form-hint">
              Negative for debits/charges, positive for credits/deposits.
            </small>
          )}
        </label>

        <label className="txn-form-field">
          <span>Status</span>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as TransactionStatus)
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="txn-form-field">
          <span>Type</span>
          <select
            value={type}
            onChange={(event) =>
              setType(event.target.value as TransactionType)
            }
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="txn-form-field">
          <span>Category</span>
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as MerchantCategory)
            }
          >
            {MERCHANT_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="txn-form-field">
          <span>Date</span>
          <input
            type="datetime-local"
            value={createdAtInput}
            onChange={(event) => setCreatedAtInput(event.target.value)}
            required
          />
        </label>

        <div className="txn-form-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={!amountValidation.ok}
          >
            {submitLabel}
          </button>
          <button
            type="button"
            className="button"
            onClick={onCancelEdit}
          >
            Cancel
          </button>
        </div>
      </form>
    </aside>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function defaultInput(): TransactionInput {
  return {
    description: '',
    amountCents: 0,
    currency: 'USD',
    status: 'pending',
    type: 'purchase',
    merchantCategory: 'shopping',
    createdAt: new Date().toISOString(),
  };
}

function inputFromTransaction(transaction: Transaction): TransactionInput {
  const { id: _id, ...rest } = transaction;
  return rest;
}

function centsToInputString(cents: number): string {
  return (cents / 100).toFixed(2);
}

type AmountValidation =
  | { ok: true; cents: number }
  | { ok: false; error: string };

/**
 * Validate the raw text from the amount input.
 *
 * We gate the input with a regex BEFORE parsing so we never silently round
 * sub-cent values like `0.001` down to 0. Cents are the smallest unit we
 * store, so anything finer than 2 decimal places is a user error.
 */
function validateAmount(value: string): AmountValidation {
  const trimmed = value.trim();
  if (trimmed === '') {
    return { ok: false, error: 'Amount is required.' };
  }
  // Reject sub-cent precision explicitly so we can give a targeted message.
  if (/^[+-]?\d*\.\d{3,}$/.test(trimmed)) {
    return {
      ok: false,
      error: 'Amount can have at most 2 decimal places (cents).',
    };
  }
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(trimmed)) {
    return {
      ok: false,
      error: 'Enter a valid amount, e.g. -12.34.',
    };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: 'Enter a valid amount.' };
  }
  return { ok: true, cents: Math.round(parsed * 100) };
}

/** Convert ISO-8601 → the local `yyyy-MM-ddTHH:mm` format expected by `<input type="datetime-local">`. */
function isoToLocalDatetimeInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function localDatetimeInputToIso(value: string): string {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}
