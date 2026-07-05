import { useState } from "react";
import { api } from "../api";

const TYPES = ["checking", "savings", "credit_card", "cash"];

export default function AccountsView({ accounts, onChange }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("checking");
  const [error, setError] = useState(null);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.accounts.create({ name: name.trim(), type });
      setName("");
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this account and all its transactions?")) return;
    await api.accounts.remove(id);
    onChange();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          placeholder="New account name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-sm"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>{t.replace("_", " ")}</option>
          ))}
        </select>
        <button className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium">Add</button>
      </form>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
        {accounts.length === 0 && (
          <p className="text-center text-slate-500 p-4 text-sm">No accounts yet — add one above.</p>
        )}
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-slate-900">
            <div>
              <p className="text-sm font-medium">{a.name}</p>
              <p className="text-xs text-slate-500 capitalize">{a.type.replace("_", " ")}</p>
            </div>
            <button
              onClick={() => handleDelete(a.id)}
              className="text-xs text-red-600 dark:text-red-400 font-medium"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
