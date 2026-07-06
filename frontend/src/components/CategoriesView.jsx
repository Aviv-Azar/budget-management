import { useState } from "react";
import { api } from "../api";
import { categoryIcon } from "../categoryIcons";

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
    <div className="space-y-5">
      <form onSubmit={handleAdd} className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-xl border border-border bg-surface-2 text-ink placeholder:text-faint px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="rounded-xl border border-border bg-surface-2 text-ink px-2.5 py-2.5 text-sm"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-10 h-10 rounded-xl border border-border bg-transparent shrink-0"
        />
        <button className="rounded-xl bg-accent text-white px-4 py-2.5 text-sm font-bold active:scale-95 transition-transform">
          Add
        </button>
      </form>
      {error && <p className="text-sm text-expense font-medium">{error}</p>}

      <CategoryGroup title="Expense categories" items={expense} onDelete={handleDelete} />
      <CategoryGroup title="Income categories" items={income} onDelete={handleDelete} />
    </div>
  );
}

function CategoryGroup({ title, items, onDelete }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-faint mb-2 px-1">{title}</p>
      <div className="rounded-2xl overflow-hidden bg-surface divide-y divide-border">
        {items.length === 0 && <p className="text-center text-muted p-5 text-sm">None yet.</p>}
        {items.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0"
              style={{ backgroundColor: `${c.color}26` }}
            >
              {categoryIcon(c.name)}
            </span>
            <span className="flex-1 text-[15px] font-semibold">{c.name}</span>
            <button onClick={() => onDelete(c.id)} className="text-xs text-expense font-bold px-2 py-1">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
