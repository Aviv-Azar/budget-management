import { useState } from "react";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function TransactionForm({ accounts, categories, initial, onSave, onDelete, onCancel }) {
  const isExpense = initial?.amount == null ? true : initial.amount < 0;
  const [form, setForm] = useState({
    account_id: initial?.account_id ?? accounts[0]?.id ?? "",
    category_id: initial?.category_id ?? "",
    date: initial?.date ?? todayISO(),
    amount: initial?.amount != null ? Math.abs(initial.amount) : "",
    description: initial?.description ?? "",
    merchant: initial?.merchant ?? "",
    notes: initial?.notes ?? "",
  });
  const [kind, setKind] = useState(isExpense ? "expense" : "income");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.account_id || !form.amount || !form.description) {
      setError("Account, description, and amount are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const amount = kind === "expense" ? -Math.abs(Number(form.amount)) : Math.abs(Number(form.amount));
      await onSave({
        account_id: Number(form.account_id),
        category_id: form.category_id ? Number(form.category_id) : null,
        date: form.date,
        amount,
        description: form.description,
        merchant: form.merchant || null,
        notes: form.notes || null,
        source: initial?.source ?? "manual",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="fixed inset-0 z-20 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md sm:rounded-xl rounded-t-xl p-4 space-y-3 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-semibold">{initial?.id ? "Edit transaction" : "Add transaction"}</h2>

        {initial?.raw_text && (
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer">Scanned text (tap to check if something looks wrong)</summary>
            <pre className="whitespace-pre-wrap mt-1 bg-slate-100 dark:bg-slate-800 rounded p-2">{initial.raw_text}</pre>
          </details>
        )}

        <div className="flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700">
          {["expense", "income"].map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => setKind(k)}
              className={`flex-1 py-2 text-sm font-medium capitalize ${
                kind === k
                  ? k === "expense"
                    ? "bg-red-500 text-white"
                    : "bg-green-500 text-white"
                  : "bg-transparent text-slate-600 dark:text-slate-300"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder="Amount"
          value={form.amount}
          onChange={(e) => set("amount", e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-lg"
        />

        <input
          type="text"
          placeholder="Description"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
        />

        <input
          type="text"
          placeholder="Merchant (optional)"
          value={form.merchant}
          onChange={(e) => set("merchant", e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
        />

        <div className="flex gap-2">
          <input
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
          />
        </div>

        <select
          value={form.account_id}
          onChange={(e) => set("account_id", e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
        >
          <option value="" disabled>Account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <select
          value={form.category_id}
          onChange={(e) => set("category_id", e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
        >
          <option value="">No category</option>
          {categories.filter((c) => c.kind === kind).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <textarea
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
          rows={2}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 pt-1">
          {initial?.id && (
            <button
              type="button"
              onClick={() => onDelete(initial.id)}
              className="px-4 py-2 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-sm font-medium"
            >
              Delete
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
