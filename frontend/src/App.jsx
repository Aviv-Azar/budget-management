import { useEffect, useState } from "react";
import { api } from "./api";
import TransactionsView from "./components/TransactionsView";
import AccountsView from "./components/AccountsView";
import CategoriesView from "./components/CategoriesView";
import ImportView from "./components/ImportView";

const TABS = [
  { key: "transactions", label: "Transactions", icon: "📒" },
  { key: "import", label: "Import", icon: "📥" },
  { key: "accounts", label: "Accounts", icon: "🏦" },
  { key: "categories", label: "Categories", icon: "🏷️" },
];

export default function App() {
  const [tab, setTab] = useState("transactions");
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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <h1 className="text-lg font-semibold">Budget Manager</h1>
      </header>

      <main className="flex-1 overflow-y-auto pb-20 px-4 pt-4 max-w-2xl w-full mx-auto">
        {!loaded ? (
          <p className="text-center text-slate-500 mt-10">Loading…</p>
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

      <nav className="fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${
              tab === t.key
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
