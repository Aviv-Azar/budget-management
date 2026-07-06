import { useState } from "react";
import { api } from "../api";

const NONE = "__none__";
const selectClass = "mt-1 w-full rounded-xl border border-border bg-surface-2 text-ink px-3 py-2 text-sm";
const labelClass = "text-[11px] font-bold uppercase tracking-wider text-faint";

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
      <div className="rounded-2xl bg-surface px-6 py-10 text-center mt-2">
        <div className="text-4xl mb-3">📥</div>
        <p className="text-sm text-muted">Add an account first (Accounts tab), then come back to import a file.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass}>Import into account</label>
        <select
          value={accountId}
          onChange={(e) => {
            setAccountId(e.target.value);
            reset();
          }}
          className={selectClass}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {!result && (
        <div>
          <label className={labelClass}>Bank/card statement file (CSV or Excel)</label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="mt-1 w-full text-sm text-muted file:mr-3 file:rounded-xl file:border-0 file:bg-accent file:text-white file:px-3.5 file:py-2.5 file:text-sm file:font-bold"
          />
        </div>
      )}

      {loading && <p className="text-center text-muted text-sm">Working…</p>}
      {error && <p className="text-sm text-expense font-medium">{error}</p>}

      {preview && mapping && !result && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-surface overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-surface-2">
                  {preview.columns.map((c) => (
                    <th key={c} className="px-3 py-2 text-left font-bold whitespace-nowrap text-faint uppercase tracking-wide">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    {preview.columns.map((c) => (
                      <td key={c} className="px-3 py-2 whitespace-nowrap text-muted">{String(row[c] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-faint">{preview.row_count} rows detected. Map the columns below.</p>

          <div className="grid grid-cols-2 gap-3">
            <ColumnSelect label="Date column" columns={preview.columns} value={mapping.date_col} onChange={(v) => setM("date_col", v)} />
            <ColumnSelect label="Description column" columns={preview.columns} value={mapping.description_col} onChange={(v) => setM("description_col", v)} />
            <ColumnSelect label="Merchant column (optional)" columns={preview.columns} value={mapping.merchant_col} onChange={(v) => setM("merchant_col", v)} allowNone />
          </div>

          <div className="flex rounded-xl overflow-hidden bg-surface-2 p-1 text-sm">
            <button
              type="button"
              onClick={() => setM("amount_mode", "single")}
              className={`flex-1 py-2 rounded-lg font-bold transition-colors ${mapping.amount_mode === "single" ? "bg-accent text-white" : "text-faint"}`}
            >
              Single amount column
            </button>
            <button
              type="button"
              onClick={() => setM("amount_mode", "debit_credit")}
              className={`flex-1 py-2 rounded-lg font-bold transition-colors ${mapping.amount_mode === "debit_credit" ? "bg-accent text-white" : "text-faint"}`}
            >
              Separate debit/credit
            </button>
          </div>

          {mapping.amount_mode === "single" ? (
            <div className="space-y-2">
              <ColumnSelect label="Amount column" columns={preview.columns} value={mapping.amount_col} onChange={(v) => setM("amount_col", v)} />
              <label className="flex items-center gap-2 text-sm text-muted">
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

          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={mapping.dayfirst} onChange={(e) => setM("dayfirst", e.target.checked)} />
            Dates are day-first (DD/MM/YYYY) rather than month-first
          </label>

          <div className="flex gap-2">
            <button onClick={reset} className="px-4 py-2.5 rounded-xl text-sm font-bold text-muted">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform"
            >
              Import {preview.row_count} rows
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-surface p-4 text-sm space-y-1.5">
            <p><span className="font-extrabold text-income">{result.imported}</span> transactions imported</p>
            <p><span className="font-extrabold text-ink">{result.skipped_duplicates}</span> skipped as duplicates</p>
            {result.skipped_errors > 0 && (
              <p><span className="font-extrabold text-expense">{result.skipped_errors}</span> rows had errors and were skipped</p>
            )}
          </div>
          {result.errors?.length > 0 && (
            <ul className="text-xs text-expense space-y-0.5">
              {result.errors.map((e, i) => (
                <li key={i}>Row {e.row}: {e.reason}</li>
              ))}
            </ul>
          )}
          <button onClick={reset} className="w-full px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-bold active:scale-95 transition-transform">
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
      <label className={labelClass}>{label}</label>
      <select
        value={value ?? NONE}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
      >
        {allowNone && <option value={NONE}>None</option>}
        {columns.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  );
}
