import { useState } from "react";
import { api } from "../api";

export default function CategoriesView({ categories, onChange }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("expense");
  const [color, setColor] = useState("#6366f1");
  const [error, setError] = useState(null);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.categories.create({ name: name.trim(), kind, color });
      setName("");
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this category? Transactions using it will become uncategorized.")) return;
    await api.categories.remove(id);
    onChange();
  }

  const income = categories.filter((c) => c.kind === "income");
  const expense = categories.filter((c) => c.kind === "expense");

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-sm"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-9 h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
        />
        <button className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium">Add</button>
      </form>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <CategoryGroup title="Expense categories" items={expense} onDelete={handleDelete} />
      <CategoryGroup title="Income categories" items={income} onDelete={handleDelete} />
    </div>
  );
}

function CategoryGroup({ title, items, onDelete }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-1">{title}</p>
      <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
        {items.length === 0 && <p className="text-center text-slate-500 p-3 text-sm">None yet.</p>}
        {items.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-900">
            <span className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name}
            </span>
            <button onClick={() => onDelete(c.id)} className="text-xs text-red-600 dark:text-red-400 font-medium">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
