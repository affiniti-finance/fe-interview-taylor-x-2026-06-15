import 'react-router';
import { createRequestHandler } from '@react-router/express';
import express from 'express';
import { seedTransactions } from '../src/data/seed';
import type {
  MerchantCategory,
  Transaction,
  TransactionInput,
  TransactionStatus,
  TransactionType,
} from '../src/types';

export const app = express();

app.use(express.json());

// ---------------------------------------------------------------------------
// In-memory store. Real apps would back this with a DB; for the exercise we
// just seed once at boot. State lives for the life of the dev server.
// ---------------------------------------------------------------------------
const store = new Map<string, Transaction>(
  seedTransactions.map((t) => [t.id, t]),
);

let lastNumericId = seedTransactions.reduce((max, t) => {
  const match = /^txn_(\d+)$/.exec(t.id);
  return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
}, 1000);

function nextId(): string {
  lastNumericId += 1;
  return `txn_${lastNumericId}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const STATUSES: readonly TransactionStatus[] = [
  'pending',
  'posted',
  'declined',
];
const TYPES: readonly TransactionType[] = [
  'purchase',
  'refund',
  'transfer',
  'fee',
  'interest',
];
const CATEGORIES: readonly MerchantCategory[] = [
  'groceries',
  'travel',
  'dining',
  'payroll',
  'utilities',
  'entertainment',
  'shopping',
  'health',
  'transfer',
  'income',
  'fees',
];

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return (
    typeof value === 'string' && (allowed as readonly string[]).includes(value)
  );
}

/**
 * Validate a transaction body. `partial=false` (POST/PUT) requires every
 * field; `partial=true` (PATCH) only validates fields that are present.
 */
function validateBody(
  body: unknown,
  { partial }: { partial: boolean },
): ValidationResult<Partial<TransactionInput>> {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }
  const b = body as Record<string, unknown>;
  const value: Partial<TransactionInput> = {};

  if ('description' in b) {
    const desc = b.description;
    if (typeof desc !== 'string' || desc.trim() === '') {
      return { ok: false, error: 'description must be a non-empty string.' };
    }
    value.description = desc.trim();
  } else if (!partial) {
    return { ok: false, error: 'description is required.' };
  }

  if ('amountCents' in b) {
    if (!Number.isInteger(b.amountCents)) {
      return { ok: false, error: 'amountCents must be an integer (cents).' };
    }
    value.amountCents = b.amountCents as number;
  } else if (!partial) {
    return { ok: false, error: 'amountCents is required.' };
  }

  if ('currency' in b) {
    if (typeof b.currency !== 'string' || !/^[A-Z]{3}$/.test(b.currency)) {
      return { ok: false, error: 'currency must be a 3-letter ISO code.' };
    }
    value.currency = b.currency;
  } else if (!partial) {
    return { ok: false, error: 'currency is required.' };
  }

  if ('status' in b) {
    if (!isOneOf(b.status, STATUSES)) {
      return {
        ok: false,
        error: `status must be one of: ${STATUSES.join(', ')}.`,
      };
    }
    value.status = b.status;
  } else if (!partial) {
    return { ok: false, error: 'status is required.' };
  }

  if ('type' in b) {
    if (!isOneOf(b.type, TYPES)) {
      return {
        ok: false,
        error: `type must be one of: ${TYPES.join(', ')}.`,
      };
    }
    value.type = b.type;
  } else if (!partial) {
    return { ok: false, error: 'type is required.' };
  }

  if ('merchantCategory' in b) {
    if (!isOneOf(b.merchantCategory, CATEGORIES)) {
      return {
        ok: false,
        error: `merchantCategory must be one of: ${CATEGORIES.join(', ')}.`,
      };
    }
    value.merchantCategory = b.merchantCategory;
  } else if (!partial) {
    return { ok: false, error: 'merchantCategory is required.' };
  }

  if ('createdAt' in b) {
    if (
      typeof b.createdAt !== 'string' ||
      Number.isNaN(Date.parse(b.createdAt))
    ) {
      return {
        ok: false,
        error: 'createdAt must be an ISO 8601 timestamp.',
      };
    }
    value.createdAt = new Date(b.createdAt).toISOString();
  } else if (!partial) {
    return { ok: false, error: 'createdAt is required.' };
  }

  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/transactions — list with optional filtering.
 *
 * Query params (all optional):
 *   - `status`: 'pending' | 'posted' | 'declined' | 'all'
 *   - `type`:   'purchase' | 'refund' | 'transfer' | 'fee' | 'interest' | 'all'
 *   - `q`:      case-insensitive substring match on `description`
 */
app.get('/api/transactions', async (req, res) => {
  // Existing artificial latency, preserved so the client can still
  // exercise loading behavior on the initial fetch.
  await new Promise((resolve) => setTimeout(resolve, 500));

  const { status, type, q } = req.query;
  let rows = Array.from(store.values());

  if (typeof status === 'string' && status !== 'all') {
    if (!isOneOf(status, STATUSES)) {
      res.status(400).json({
        error: `status must be one of: all, ${STATUSES.join(', ')}.`,
      });
      return;
    }
    rows = rows.filter((t) => t.status === status);
  }

  if (typeof type === 'string' && type !== 'all') {
    if (!isOneOf(type, TYPES)) {
      res.status(400).json({
        error: `type must be one of: all, ${TYPES.join(', ')}.`,
      });
      return;
    }
    rows = rows.filter((t) => t.type === type);
  }

  if (typeof q === 'string' && q.trim() !== '') {
    const term = q.trim().toLowerCase();
    rows = rows.filter((t) => t.description.toLowerCase().includes(term));
  }

  res.json(rows);
});

/** GET /api/transactions/:id — fetch one. */
app.get('/api/transactions/:id', (req, res) => {
  const existing = store.get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Transaction not found.' });
    return;
  }
  res.json(existing);
});

/** POST /api/transactions — create. Server assigns the id. */
app.post('/api/transactions', (req, res) => {
  const validation = validateBody(req.body, { partial: false });
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }
  const created: Transaction = {
    id: nextId(),
    ...(validation.value as TransactionInput),
  };
  store.set(created.id, created);
  res.status(201).json(created);
});

/** PUT /api/transactions/:id — full replace. All fields required. */
app.put('/api/transactions/:id', (req, res) => {
  if (!store.has(req.params.id)) {
    res.status(404).json({ error: 'Transaction not found.' });
    return;
  }
  const validation = validateBody(req.body, { partial: false });
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }
  const updated: Transaction = {
    id: req.params.id,
    ...(validation.value as TransactionInput),
  };
  store.set(updated.id, updated);
  res.json(updated);
});

/** PATCH /api/transactions/:id — partial update; only validates supplied fields. */
app.patch('/api/transactions/:id', (req, res) => {
  const existing = store.get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Transaction not found.' });
    return;
  }
  const validation = validateBody(req.body, { partial: true });
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }
  const updated: Transaction = { ...existing, ...validation.value };
  store.set(updated.id, updated);
  res.json(updated);
});

/** DELETE /api/transactions/:id */
app.delete('/api/transactions/:id', (req, res) => {
  const existed = store.delete(req.params.id);
  if (!existed) {
    res.status(404).json({ error: 'Transaction not found.' });
    return;
  }
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// React Router catch-all (must come after the API routes)
// ---------------------------------------------------------------------------
app.use(
  createRequestHandler({
    build: () => import('virtual:react-router/server-build'),
  }),
);
