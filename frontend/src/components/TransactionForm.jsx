import { useState } from "react";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const KIND_LABELS = { expense: "הוצאה", income: "הכנסה" };

const inputClass =
  "w-full rounded-xl border border-border bg-surface-2 text-ink placeholder:text-faint px-3.5 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-accent";

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
      setError("יש למלא חשבון, תיאור וסכום.");
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
      className="fixed inset-0 z-20 bg-black/60 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-surface w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-5 space-y-3.5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold">{initial?.id ? "עריכת תנועה" : "הוספת תנועה"}</h2>
          <button type="button" onClick={onCancel} className="text-faint text-xl leading-none px-1">
            ×
          </button>
        </div>

        {initial?.raw_text && (
          <details className="text-xs text-muted">
            <summary className="cursor-pointer font-semibold">טקסט סרוק (הקישו לבדיקה אם משהו נראה לא נכון)</summary>
            <pre className="whitespace-pre-wrap mt-1.5 bg-surface-2 rounded-lg p-2.5">{initial.raw_text}</pre>
          </details>
        )}

        <div className="flex rounded-xl overflow-hidden bg-surface-2 p-1">
          {["expense", "income"].map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => setKind(k)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                kind === k
                  ? k === "expense"
                    ? "bg-expense-soft text-expense"
                    : "bg-income-soft text-income"
                  : "text-faint"
              }`}
            >
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center py-2">
          <span className={`text-2xl font-extrabold me-1 ${kind === "expense" ? "text-expense" : "text-income"}`}>
            {kind === "expense" ? "−₪" : "+₪"}
          </span>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            className={`bg-transparent text-4xl font-extrabold tracking-tight w-40 text-center focus:outline-none placeholder:text-faint ${
              kind === "expense" ? "text-expense" : "text-income"
            }`}
          />
        </div>

        <input
          type="text"
          placeholder="תיאור"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className={inputClass}
        />

        <input
          type="text"
          placeholder="בית עסק (רשות)"
          value={form.merchant}
          onChange={(e) => set("merchant", e.target.value)}
          className={inputClass}
        />

        <div className="flex gap-2">
          <input
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
            className={`flex-1 ${inputClass}`}
          />
        </div>

        <select
          value={form.account_id}
          onChange={(e) => set("account_id", e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>חשבון</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <select
          value={form.category_id}
          onChange={(e) => set("category_id", e.target.value)}
          className={inputClass}
        >
          <option value="">ללא קטגוריה</option>
          {categories.filter((c) => c.kind === kind).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <textarea
          placeholder="הערות (רשות)"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          className={inputClass}
          rows={2}
        />

        {error && <p className="text-sm text-expense font-medium">{error}</p>}

        <div className="flex gap-2 pt-1">
          {initial?.id && (
            <button
              type="button"
              onClick={() => onDelete(initial.id)}
              className="px-4 py-2.5 rounded-xl bg-expense-soft text-expense text-sm font-bold active:scale-95 transition-transform"
            >
              מחיקה
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-muted"
          >
            ביטול
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform"
          >
            {saving ? "שומר…" : "שמירה"}
          </button>
        </div>
      </div>
    </form>
  );
}
