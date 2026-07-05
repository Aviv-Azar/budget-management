import { useState } from "react";
import { api } from "../api";

const NONE = "__none__";

export default function ImportView({ accounts }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // {columns, rows, row_count, saved_mapping}
  const [mapping, setMapping] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f || !accountId) return;
    setFile(f);
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await api.imports.preview(f, accountId);
      setPreview(data);
      setMapping(
        data.saved_mapping ?? {
          date_col: data.columns[0] ?? "",
          description_col: data.columns[1] ?? "",
          merchant_col: null,
          amount_mode: "single",
          amount_col: data.columns[2] ?? "",
          debit_col: null,
          credit_col: null,
          flip_sign: false,
          dayfirst: false,
        }
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function setM(field, value) {
    setMapping((m) => ({ ...m, [field]: value === NONE ? null : value }));
  }

  async function handleImport() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.imports.commit(file, accountId, mapping);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setMapping(null);
    setResult(null);
    setError(null);
  }

  if (accounts.length === 0) {
    return (
      <p className="text-center text-slate-500 mt-8 text-sm">
        Add an account first (Accounts tab), then come back to import a file.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-slate-500">Import into account</label>
        <select
          value={accountId}
          onChange={(e) => {
            setAccountId(e.target.value);
            reset();
          }}
          className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {!result && (
        <div>
          <label className="text-xs font-medium text-slate-500">Bank/card statement file (CSV or Excel)</label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="mt-1 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:px-3 file:py-2 file:text-sm"
          />
        </div>
      )}

      {loading && <p className="text-center text-slate-500 text-sm">Working…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {preview && mapping && !result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800">
                  {preview.columns.map((c) => (
                    <th key={c} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-200 dark:border-slate-800">
                    {preview.columns.map((c) => (
                      <td key={c} className="px-2 py-1.5 whitespace-nowrap">{String(row[c] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">{preview.row_count} rows detected. Map the columns below.</p>

          <div className="grid grid-cols-2 gap-3">
            <ColumnSelect label="Date column" columns={preview.columns} value={mapping.date_col} onChange={(v) => setM("date_col", v)} />
            <ColumnSelect label="Description column" columns={preview.columns} value={mapping.description_col} onChange={(v) => setM("description_col", v)} />
            <ColumnSelect label="Merchant column (optional)" columns={preview.columns} value={mapping.merchant_col} onChange={(v) => setM("merchant_col", v)} allowNone />
          </div>

          <div className="flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 text-sm">
            <button
              type="button"
              onClick={() => setM("amount_mode", "single")}
              className={`flex-1 py-2 ${mapping.amount_mode === "single" ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300"}`}
            >
              Single amount column
            </button>
            <button
              type="button"
              onClick={() => setM("amount_mode", "debit_credit")}
              className={`flex-1 py-2 ${mapping.amount_mode === "debit_credit" ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300"}`}
            >
              Separate debit/credit
            </button>
          </div>

          {mapping.amount_mode === "single" ? (
            <div className="space-y-2">
              <ColumnSelect label="Amount column" columns={preview.columns} value={mapping.amount_col} onChange={(v) => setM("amount_col", v)} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={mapping.flip_sign} onChange={(e) => setM("flip_sign", e.target.checked)} />
                Flip sign (check this if expenses appear as positive numbers in the file)
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <ColumnSelect label="Debit column (money out)" columns={preview.columns} value={mapping.debit_col} onChange={(v) => setM("debit_col", v)} allowNone />
              <ColumnSelect label="Credit column (money in)" columns={preview.columns} value={mapping.credit_col} onChange={(v) => setM("credit_col", v)} allowNone />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={mapping.dayfirst} onChange={(e) => setM("dayfirst", e.target.checked)} />
            Dates are day-first (DD/MM/YYYY) rather than month-first
          </label>

          <div className="flex gap-2">
            <button onClick={reset} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
            >
              Import {preview.row_count} rows
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 text-sm space-y-1">
            <p><span className="font-semibold text-green-600 dark:text-green-400">{result.imported}</span> transactions imported</p>
            <p><span className="font-semibold">{result.skipped_duplicates}</span> skipped as duplicates</p>
            {result.skipped_errors > 0 && (
              <p><span className="font-semibold text-red-500">{result.skipped_errors}</span> rows had errors and were skipped</p>
            )}
          </div>
          {result.errors?.length > 0 && (
            <ul className="text-xs text-red-500 space-y-0.5">
              {result.errors.map((e, i) => (
                <li key={i}>Row {e.row}: {e.reason}</li>
              ))}
            </ul>
          )}
          <button onClick={reset} className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium">
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}

function ColumnSelect({ label, columns, value, onChange, allowNone }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <select
        value={value ?? NONE}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
      >
        {allowNone && <option value={NONE}>None</option>}
        {columns.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  );
}
