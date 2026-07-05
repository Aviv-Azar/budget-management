import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
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
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label="Income" value={income} color="text-green-600 dark:text-green-400" />
        <SummaryCard label="Expenses" value={expense} color="text-red-600 dark:text-red-400" />
        <SummaryCard label="Net" value={income + expense} color="text-slate-900 dark:text-slate-100" />
      </div>

      <div className="flex items-center gap-2">
        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning}
          className="rounded-lg bg-slate-700 text-white px-3 py-2 text-sm font-medium whitespace-nowrap disabled:opacity-50"
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
          className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium whitespace-nowrap"
        >
          + Add
        </button>
      </div>

      {scanError && <p className="text-sm text-red-500">{scanError}</p>}

      {loading ? (
        <p className="text-center text-slate-500 mt-8">Loading…</p>
      ) : transactions.length === 0 ? (
        <p className="text-center text-slate-500 mt-8">No transactions yet. Add one, or import a file.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <p className="text-xs font-medium text-slate-500 mb-1">
                {new Date(date + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
                {items.map((t) => {
                  const cat = t.category_id ? categoryById[t.category_id] : null;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setEditing(t)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-white dark:bg-slate-900 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.description}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {cat && (
                            <span
                              className="text-[11px] px-1.5 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: cat.color }}
                            >
                              {cat.name}
                            </span>
                          )}
                          <span className="text-xs text-slate-500 truncate">{t.account.name}</span>
                        </div>
                      </div>
                      <span
                        className={`text-sm font-semibold whitespace-nowrap ${
                          t.amount < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                        }`}
                      >
                        {formatMoney(t.amount)}
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

function SummaryCard({ label, value, color }) {
  return (
    <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-2.5 text-center">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{formatMoney(value)}</p>
    </div>
  );
}
