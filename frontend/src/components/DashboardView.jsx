import { useEffect, useState } from "react";
import { api } from "../api";
import { categoryIcon } from "../categoryIcons";
import AccountsView from "./AccountsView";
import CategoriesView from "./CategoriesView";

const GROUP_LABELS = {
  income: "הכנסות",
  savings: "תוכניות חיסכון",
  bills: "חשבונות ומנויים",
  variable: "הוצאות משתנות",
  loan: "הלוואות",
};
const GROUP_ORDER = ["income", "savings", "bills", "variable", "loan"];

function formatMoney(n) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

function monthStartISO(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function monthLabel(d) {
  return d.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

export default function DashboardView({ accounts, categories, onChangeLookups }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const result = await api.dashboard.get(monthStartISO(cursor));
      setData(result);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [cursor]);

  async function handleTargetChange(categoryId, value) {
    const target_amount = Number(value) || 0;
    await api.budgets.upsert({ category_id: categoryId, month: monthStartISO(cursor), target_amount });
    refresh();
  }

  if (loading || !data) {
    return <p className="text-center text-faint mt-10 text-sm">טוען…</p>;
  }

  const spentRatio = data.income.actual > 0 ? Math.min(data.expense.actual / data.income.actual, 1) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center justify-between">
          <button
            onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center text-lg active:scale-95 transition-transform"
          >
            ‹
          </button>
          <p className="font-extrabold text-[15px]">{monthLabel(cursor)}</p>
          <button
            onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center text-lg active:scale-95 transition-transform"
          >
            ›
          </button>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center text-base active:scale-95 transition-transform"
          aria-label="ניהול חשבונות וקטגוריות"
        >
          ⚙️
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <SummaryCard label="הכנסות" value={data.income.actual} className="text-income" />
        <SummaryCard label="הוצאות" value={data.expense.actual} className="text-expense" />
        <SummaryCard label="נותר" value={data.remaining} className="text-ink" />
      </div>

      <RemainingRing spent={data.expense.actual} ratio={spentRatio} remaining={data.remaining} />

      {data.top_expenses.length > 0 && <ExpenseBreakdown items={data.top_expenses} />}

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-faint mb-1 px-1">תקציב לפי קטגוריה</p>
        <p className="text-xs text-muted px-1">
          הקלידו סכום בשדה "יעד" ליד כל קטגוריה כדי לקבוע תקציב חודשי לה. פס ההתקדמות יתמלא
          לפי מה שכבר הוצא, ויתחלף לאדום אם חורגים מהיעד. קטגוריות ללא יעד לא מציגות פס.
        </p>
      </div>

      <div className="space-y-4">
        {GROUP_ORDER.map((g) => {
          const group = data.groups.find((x) => x.group === g);
          if (!group || group.categories.length === 0) return null;
          return (
            <GroupCard key={g} group={group} onTargetChange={handleTargetChange} />
          );
        })}
      </div>

      {data.top_expenses.length > 0 && <TopExpenses items={data.top_expenses} />}

      {settingsOpen && (
        <SettingsSheet
          accounts={accounts}
          categories={categories}
          onChange={() => {
            onChangeLookups();
            refresh();
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

function SettingsSheet({ accounts, categories, onChange, onClose }) {
  const [tab, setTab] = useState("accounts");
  return (
    <div
      className="fixed inset-0 z-20 bg-black/60 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold">ניהול חשבונות וקטגוריות</h2>
          <button onClick={onClose} className="text-faint text-xl leading-none px-1">×</button>
        </div>

        <div className="flex rounded-xl overflow-hidden bg-surface-2 p-1 text-sm">
          <button
            onClick={() => setTab("accounts")}
            className={`flex-1 py-2 rounded-lg font-bold transition-colors ${tab === "accounts" ? "bg-accent text-white" : "text-faint"}`}
          >
            🏦 חשבונות
          </button>
          <button
            onClick={() => setTab("categories")}
            className={`flex-1 py-2 rounded-lg font-bold transition-colors ${tab === "categories" ? "bg-accent text-white" : "text-faint"}`}
          >
            🏷️ קטגוריות
          </button>
        </div>

        {tab === "accounts" ? (
          <AccountsView accounts={accounts} onChange={onChange} />
        ) : (
          <CategoriesView categories={categories} onChange={onChange} />
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, className }) {
  return (
    <div className="rounded-2xl bg-surface px-3 py-3.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-faint mb-1">{label}</p>
      <p className={`text-[15px] font-extrabold tracking-tight ${className}`}>{formatMoney(value)}</p>
    </div>
  );
}

function RemainingRing({ ratio, remaining }) {
  const angle = Math.round(ratio * 360);
  return (
    <div className="rounded-2xl bg-surface p-5 flex items-center gap-5">
      <div
        className="w-24 h-24 rounded-full shrink-0 flex items-center justify-center"
        style={{
          background: `conic-gradient(var(--color-expense) 0deg ${angle}deg, var(--color-surface-3) ${angle}deg 360deg)`,
        }}
      >
        <div className="w-[72px] h-[72px] rounded-full bg-surface flex items-center justify-center">
          <span className="text-xs font-extrabold">{Math.round(ratio * 100)}%</span>
        </div>
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-faint mb-1">נותר להוצאה</p>
        <p className="text-2xl font-extrabold tracking-tight">{formatMoney(remaining)}</p>
        <p className="text-xs text-muted mt-1">הכנסות פחות הוצאות בחודש זה</p>
      </div>
    </div>
  );
}

function ExpenseBreakdown({ items }) {
  let cursor = 0;
  const stops = items.map((item) => {
    const start = cursor;
    cursor += item.percent;
    return `${item.color} ${start}% ${cursor}%`;
  });
  return (
    <div className="rounded-2xl bg-surface p-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-faint mb-1">חלוקת ההוצאות לפי קטגוריה</p>
      <p className="text-xs text-muted mb-4">איפה הולך רוב הכסף החודש</p>
      <div className="flex items-center gap-5">
        <div
          className="w-28 h-28 rounded-full shrink-0"
          style={{ background: `conic-gradient(${stops.join(", ")})` }}
        />
        <div className="flex-1 min-w-0 flex flex-wrap gap-x-3 gap-y-1.5">
          {items.slice(0, 6).map((item) => (
            <span key={item.category_id} className="flex items-center gap-1.5 text-xs text-muted">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function GroupCard({ group, onTargetChange }) {
  return (
    <div className="rounded-2xl bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-surface-2">
        <p className="text-[13px] font-extrabold">{GROUP_LABELS[group.group]}</p>
        <p className="text-xs text-muted">
          {formatMoney(group.actual)} <span className="text-faint">/ {formatMoney(group.target)}</span>
        </p>
      </div>
      <div className="divide-y divide-border">
        {group.categories.map((c) => (
          <CategoryRow key={c.category_id} category={c} onTargetChange={onTargetChange} />
        ))}
      </div>
    </div>
  );
}

function CategoryRow({ category, onTargetChange }) {
  const [target, setTarget] = useState(category.target || "");
  const ratio = category.target > 0 ? Math.min(category.actual / category.target, 1) : 0;
  const over = category.target > 0 && category.actual > category.target;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3 mb-2">
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
          style={{ backgroundColor: `${category.color}26` }}
        >
          {categoryIcon(category.name)}
        </span>
        <p className="flex-1 text-sm font-semibold truncate">{category.name}</p>
        <p className={`text-sm font-bold whitespace-nowrap ${over ? "text-expense" : "text-ink"}`}>
          {formatMoney(category.actual)}
        </p>
        <div className="flex items-center gap-1 text-xs text-faint whitespace-nowrap">
          <span>יעד</span>
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onBlur={(e) => onTargetChange(category.category_id, e.target.value)}
            className="w-16 rounded-lg bg-surface-2 px-1.5 py-1 text-xs text-ink text-center focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>
      {category.target > 0 && (
        <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
          <div
            className={`h-full rounded-full ${over ? "bg-expense" : "bg-income"}`}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

function TopExpenses({ items }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-faint mb-3 px-1">
        ההוצאות הגדולות ביותר החודש
      </p>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={item.category_id} className="flex items-center gap-3">
            <span className="text-xs text-faint w-4 text-center shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold truncate">{item.name}</span>
                <span className="text-xs text-muted whitespace-nowrap">
                  {formatMoney(item.actual)} · {item.percent}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${item.percent}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
