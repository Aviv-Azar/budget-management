const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function requestForm(path, formData) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

export const api = {
  accounts: {
    list: () => request("/accounts"),
    create: (data) => request("/accounts", { method: "POST", body: JSON.stringify(data) }),
    update: (id, data) => request(`/accounts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id) => request(`/accounts/${id}`, { method: "DELETE" }),
  },
  categories: {
    list: () => request("/categories"),
    create: (data) => request("/categories", { method: "POST", body: JSON.stringify(data) }),
    update: (id, data) => request(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id) => request(`/categories/${id}`, { method: "DELETE" }),
  },
  transactions: {
    list: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""))
      ).toString();
      return request(`/transactions${qs ? `?${qs}` : ""}`);
    },
    create: (data) => request("/transactions", { method: "POST", body: JSON.stringify(data) }),
    update: (id, data) => request(`/transactions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id) => request(`/transactions/${id}`, { method: "DELETE" }),
  },
  receipts: {
    scan: (file) => {
      const form = new FormData();
      form.append("file", file);
      return requestForm("/receipts/scan", form);
    },
  },
  imports: {
    preview: (file, accountId) => {
      const form = new FormData();
      form.append("file", file);
      form.append("account_id", accountId);
      return requestForm("/import/preview", form);
    },
    commit: (file, accountId, mapping) => {
      const form = new FormData();
      form.append("file", file);
      form.append("account_id", accountId);
      form.append("mapping", JSON.stringify(mapping));
      return requestForm("/import/commit", form);
    },
  },
  budgets: {
    list: (month) => request(`/budgets?month=${month}`),
    upsert: (data) => request("/budgets", { method: "PUT", body: JSON.stringify(data) }),
  },
  dashboard: {
    get: (month) => request(`/dashboard?month=${month}`),
  },
};
