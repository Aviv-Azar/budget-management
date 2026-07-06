import { useState } from "react";
import { api } from "../api";

const TYPES = ["checking", "savings", "credit_card", "cash"];
const TYPE_ICONS = { checking: "🏦", savings: "🐷", credit_card: "💳", cash: "💵" };
const TYPE_LABELS = { checking: "עו״ש", savings: "חיסכון", credit_card: "אשראי", cash: "מזומן" };

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
    if (!confirm("למחוק את החשבון הזה ואת כל התנועות שלו?")) return;
    await api.accounts.remove(id);
    onChange();
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted leading-relaxed">
        הוסיפו כאן כל חשבון בנק, כרטיס אשראי, קופת חיסכון או ארנק מזומן שברצונכם לעקוב אחריו —
        כל תנועה (ידנית, מיובאת, סרוקה או מוואטסאפ) משויכת לאחד מהם, וניתן לסנן לפיו בלשונית הפעילות.
      </p>
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          placeholder="שם חשבון חדש"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-xl border border-border bg-surface-2 text-ink placeholder:text-faint px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-xl border border-border bg-surface-2 text-ink px-2.5 py-2.5 text-sm"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <button className="rounded-xl bg-accent text-white px-4 py-2.5 text-sm font-bold active:scale-95 transition-transform">
          הוספה
        </button>
      </form>
      {error && <p className="text-sm text-expense font-medium">{error}</p>}

      <div className="rounded-2xl overflow-hidden bg-surface divide-y divide-border">
        {accounts.length === 0 && (
          <p className="text-center text-muted p-6 text-sm">עדיין אין חשבונות — הוסיפו אחד למעלה.</p>
        )}
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-4 py-3.5">
            <span className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center text-base shrink-0">
              {TYPE_ICONS[a.type] ?? "🏦"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold truncate">{a.name}</p>
              <p className="text-xs text-muted">{TYPE_LABELS[a.type] ?? a.type}</p>
            </div>
            <button
              onClick={() => handleDelete(a.id)}
              className="text-xs text-expense font-bold px-2 py-1"
            >
              מחיקה
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
