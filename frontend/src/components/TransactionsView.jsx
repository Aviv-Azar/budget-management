import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { categoryIcon } from "../categoryIcons";
import TransactionForm from "./TransactionForm";

function formatMoney(n) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthBounds(d = new Date()) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

export default function TransactionsView({ accounts, categories }) {
  const [transactions, setTransactions] = useState([]);
  const [accountFilter, setAccountFilter] = useState("");
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = edit/draft
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const fileInputRef = useRef(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await api.transactions.list({ account_id: accountFilter || undefined });
      setTransactions(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [accountFilter]);

  const categoryById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const { from, to } = monthBounds();
  const monthTx = transactions.filter((t) => t.date >= from && t.date <= to);
  const income = monthTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  const grouped = useMemo(() => {
    const groups = {};
    for (const t of transactions) {
      (groups[t.date] ??= []).push(t);
    }
    return Object.entries(groups).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [transactions]);

  async function handleSave(data) {
    if (editing?.id) {
      await api.transactions.update(editing.id, data);
    } else {
      await api.transactions.create(data);
    }
    setEditing(null);
    await refresh();
  }

  async function handleDelete(id) {
    await api.transactions.remove(id);
    setEditing(null);
    await refresh();
  }

  async function handleScanFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file) return;
    setScanning(true);
    setScanError(null);
    try {
      const result = await api.receipts.scan(file);
      setEditing({
        account_id: Number(accountFilter) || accounts[0]?.id || "",
        category_id: null,
        date: result.date ?? todayISO(),
        amount: result.amount != null ? -Math.abs(result.amount) : null,
        description: result.merchant ?? "Receipt",
        merchant: result.merchant ?? null,
        source: "ocr",
        raw_text: result.raw_text,
      });
    } catch (err) {
      setScanError(err.message);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2.5">
        <SummaryCard label="Income" value={income} tone="income" />
        <SummaryCard label="Expenses" value={expense} tone="expense" />
        <SummaryCard label="Net" value={income + expense} tone="net" />
      </div>

      <div className="flex items-center gap-2">
        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          className="flex-1 rounded-xl border border-border bg-surface text-ink px-3 py-2.5 text-sm font-medium"
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning}
          className="rounded-xl bg-surface border border-border text-ink px-3.5 py-2.5 text-sm font-bold whitespace-nowrap disabled:opacity-50 active:scale-95 transition-transform"
        >
          {scanning ? "Scanning…" : "📷 Scan"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleScanFile}
          className="hidden"
        />
        <button
          onClick={() => setEditing({})}
          className="rounded-xl bg-accent text-white px-4 py-2.5 text-sm font-bold whitespace-nowrap active:scale-95 transition-transform"
        >
          + Add
        </button>
      </div>

      {scanError && <p className="text-sm text-expense">{scanError}</p>}

      {loading ? (
        <p className="text-center text-faint mt-10 text-sm">Loading…</p>
      ) : transactions.length === 0 ? (
        <EmptyState onAdd={() => setEditing({})} onScan={() => fileInputRef.current?.click()} />
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-faint mb-2 px-1">
                {new Date(date + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <div className="rounded-2xl overflow-hidden bg-surface divide-y divide-border">
                {items.map((t) => {
                  const cat = t.category_id ? categoryById[t.category_id] : null;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setEditing(t)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-surface-2 transition-colors"
                    >
                      <span
                        className="w-10 h-10 rounded-full flex items-center justify-center text-base shrink-0"
                        style={{ backgroundColor: cat ? `${cat.color}26` : "var(--color-surface-3)" }}
                      >
                        {cat ? categoryIcon(cat.name) : "🏷️"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold truncate">{t.description}</p>
                        <p className="text-xs text-muted truncate mt-0.5">
                          {cat ? `${cat.name} · ` : ""}
                          {t.account.name}
                        </p>
                      </div>
                      <span
                        className={`text-[15px] font-extrabold whitespace-nowrap ${
                          t.amount < 0 ? "text-expense" : "text-income"
                        }`}
                      >
                        {t.amount < 0 ? "−" : "+"}
                        {formatMoney(Math.abs(t.amount))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <TransactionForm
          accounts={accounts}
          categories={categories}
          initial={editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

const TONE_STYLES = {
  income: "text-income",
  expense: "text-expense",
  net: "text-ink",
};

function SummaryCard({ label, value, tone }) {
  return (
    <div className="rounded-2xl bg-surface px-3 py-3.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-faint mb-1">{label}</p>
      <p className={`text-[15px] font-extrabold tracking-tight ${TONE_STYLES[tone]}`}>{formatMoney(value)}</p>
    </div>
  );
}

function EmptyState({ onAdd, onScan }) {
  return (
    <div className="rounded-2xl bg-surface px-6 py-10 text-center mt-2">
      <div className="text-4xl mb-3">📒</div>
      <p className="font-bold text-ink mb-1">No transactions yet</p>
      <p className="text-sm text-muted mb-5">Add one by hand, scan a receipt, or import a statement.</p>
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={onAdd}
          className="rounded-xl bg-accent text-white px-4 py-2.5 text-sm font-bold active:scale-95 transition-transform"
        >
          + Add transaction
        </button>
        <button
          onClick={onScan}
          className="rounded-xl bg-surface-2 border border-border text-ink px-4 py-2.5 text-sm font-bold active:scale-95 transition-transform"
        >
          📷 Scan receipt
        </button>
      </div>
    </div>
  );
}
