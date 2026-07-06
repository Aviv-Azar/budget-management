import { useState } from "react";
import { api } from "../api";
import { categoryIcon } from "../categoryIcons";

const GROUPS = ["income", "savings", "bills", "variable", "loan"];
const GROUP_LABELS = {
  income: "הכנסות",
  savings: "חיסכון",
  bills: "חשבונות",
  variable: "הוצאות משתנות",
  loan: "הלוואות",
};

export default function CategoriesView({ categories, onChange }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("expense");
  const [group, setGroup] = useState("variable");
  const [color, setColor] = useState("#6366f1");
  const [error, setError] = useState(null);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.categories.create({ name: name.trim(), kind, color, group });
      setName("");
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("למחוק את הקטגוריה הזו? תנועות שמשויכות אליה יהפכו ללא מקוטלגות.")) return;
    await api.categories.remove(id);
    onChange();
  }

  async function handleGroupChange(id, newGroup) {
    await api.categories.update(id, { group: newGroup });
    onChange();
  }

  const income = categories.filter((c) => c.kind === "income");
  const expense = categories.filter((c) => c.kind === "expense");

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted leading-relaxed">
        כל תנועה משויכת לקטגוריה, וכל קטגוריה שייכת ל"קבוצה" (הכנסות / חיסכון / חשבונות קבועים /
        הוצאות משתנות / הלוואות) — הקבוצה הזו קובעת תחת איזה חלק היא מופיעה בלוח הבקרה. אפשר
        לשנות קבוצה בכל עת מהרשימה שלמטה, גם לאחר היצירה.
      </p>
      <form onSubmit={handleAdd} className="space-y-2">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="שם קטגוריה חדשה"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-surface-2 text-ink placeholder:text-faint px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 rounded-xl border border-border bg-transparent shrink-0"
          />
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-surface-2 text-ink px-2.5 py-2.5 text-sm"
          >
            <option value="expense">הוצאה</option>
            <option value="income">הכנסה</option>
          </select>
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-surface-2 text-ink px-2.5 py-2.5 text-sm"
          >
            {GROUPS.map((g) => (
              <option key={g} value={g}>{GROUP_LABELS[g]}</option>
            ))}
          </select>
          <button className="rounded-xl bg-accent text-white px-4 py-2.5 text-sm font-bold active:scale-95 transition-transform whitespace-nowrap">
            הוספה
          </button>
        </div>
      </form>
      {error && <p className="text-sm text-expense font-medium">{error}</p>}

      <CategorySection title="קטגוריות הוצאה" items={expense} onDelete={handleDelete} onGroupChange={handleGroupChange} />
      <CategorySection title="קטגוריות הכנסה" items={income} onDelete={handleDelete} onGroupChange={handleGroupChange} />
    </div>
  );
}

function CategorySection({ title, items, onDelete, onGroupChange }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-faint mb-2 px-1">{title}</p>
      <div className="rounded-2xl overflow-hidden bg-surface divide-y divide-border">
        {items.length === 0 && <p className="text-center text-muted p-5 text-sm">עדיין אין.</p>}
        {items.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0"
              style={{ backgroundColor: `${c.color}26` }}
            >
              {categoryIcon(c.name)}
            </span>
            <span className="flex-1 text-[15px] font-semibold truncate">{c.name}</span>
            <select
              value={c.group}
              onChange={(e) => onGroupChange(c.id, e.target.value)}
              className="rounded-lg bg-surface-2 text-muted text-xs px-2 py-1.5 shrink-0"
            >
              {GROUPS.map((g) => (
                <option key={g} value={g}>{GROUP_LABELS[g]}</option>
              ))}
            </select>
            <button onClick={() => onDelete(c.id)} className="text-xs text-expense font-bold px-2 py-1">
              מחיקה
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
