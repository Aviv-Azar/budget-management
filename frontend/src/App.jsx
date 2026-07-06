import { useEffect, useState } from "react";
import { api } from "./api";
import DashboardView from "./components/DashboardView";
import TransactionsView from "./components/TransactionsView";
import AccountsView from "./components/AccountsView";
import CategoriesView from "./components/CategoriesView";
import ImportView from "./components/ImportView";

const TABS = [
  { key: "dashboard", label: "לוח בקרה", icon: "📊" },
  { key: "transactions", label: "פעילות", icon: "📒" },
  { key: "import", label: "ייבוא", icon: "📥" },
  { key: "accounts", label: "חשבונות", icon: "🏦" },
  { key: "categories", label: "קטגוריות", icon: "🏷️" },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loaded, setLoaded] = useState(false);

  async function refreshLookups() {
    const [accs, cats] = await Promise.all([api.accounts.list(), api.categories.list()]);
    setAccounts(accs);
    setCategories(cats);
  }

  useEffect(() => {
    refreshLookups().finally(() => setLoaded(true));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink">
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-border px-5 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center text-sm font-black">₪</span>
          <h1 className="text-[15px] font-extrabold tracking-tight">תקציב</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-5 max-w-2xl w-full mx-auto">
        {!loaded ? (
          <p className="text-center text-faint mt-10 text-sm">טוען…</p>
        ) : tab === "dashboard" ? (
          <DashboardView />
        ) : tab === "transactions" ? (
          <TransactionsView accounts={accounts} categories={categories} />
        ) : tab === "import" ? (
          <ImportView accounts={accounts} />
        ) : tab === "accounts" ? (
          <AccountsView accounts={accounts} onChange={refreshLookups} />
        ) : (
          <CategoriesView categories={categories} onChange={refreshLookups} />
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-surface/95 backdrop-blur border-t border-border flex">
        <div className="max-w-2xl mx-auto flex w-full">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-bold tracking-wide relative"
            >
              {tab === t.key && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />}
              <span
                className={`text-lg leading-none transition-opacity ${
                  tab === t.key ? "opacity-100" : "opacity-45"
                }`}
              >
                {t.icon}
              </span>
              <span className={tab === t.key ? "text-ink" : "text-faint"}>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
