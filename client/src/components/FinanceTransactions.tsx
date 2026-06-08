import { useEffect, useState } from "react";
import { getTransactions, createTransaction, deleteTransaction, getCategories, createRecurring } from "../financeAPI";
import type { FinanceTransaction, FinanceCategory } from "../types";
import "./css/FinanceTransactions.css";

import { currencySymbol } from "./FinanceSettings";

interface Props { currentMonth: string; currency: string; }

export default function FinanceTransactions({ currentMonth, currency }: Props) {
  const sym = currencySymbol(currency);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  const [form, setForm] = useState({
    amount: "",
    type: "expense",
    category_id: "",
    date: new Date().toISOString().slice(0, 10),
    note: "",
    is_recurring: false,
  });
  const [showNumpad, setShowNumpad] = useState(false);

  const handleNumpadKey = (key: string) => {
    setForm(f => {
      let val = f.amount;
      if (key === "⌫") {
        val = val.slice(0, -1);
      } else if (key === ".") {
        if (!val.includes(".")) val = val + ".";
      } else {
        if (val === "0") val = key;
        else if (val.length < 10) val = val + key;
      }
      return { ...f, amount: val };
    });
  };

  useEffect(() => {
    if (!showNumpad) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") handleNumpadKey(e.key);
      else if (e.key === "." || e.key === ",") handleNumpadKey(".");
      else if (e.key === "Backspace") handleNumpadKey("⌫");
      else if (e.key === "Enter" || e.key === "Escape") setShowNumpad(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showNumpad]);

  useEffect(() => {
    load();
    getCategories().then(setCategories);
  }, [currentMonth]);

  const load = () => getTransactions(currentMonth).then(setTransactions);

  const handleAdd = async () => {
    if (!form.amount || isNaN(Number(form.amount))) return;

    const categoryId = form.type === "expense" && form.category_id ? Number(form.category_id) : null;

    // Create the transaction
    await createTransaction({
      amount: Number(form.amount),
      type: form.type,
      category_id: categoryId,
      date: form.date,
      note: form.note,
      is_recurring: form.is_recurring,
    });

    // If recurring, auto-create a template in finance_recurring
    if (form.is_recurring) {
      const dayOfMonth = new Date(form.date).getDate();
      const title = form.note.trim() || categories.find(c => c.id === categoryId)?.name || "Recurring";
      await createRecurring({
        title,
        amount: Number(form.amount),
        category_id: categoryId,
        type: form.type,
        day_of_month: dayOfMonth,
      });
    }

    setForm({
      amount: "",
      type: "expense",
      category_id: "",
      date: new Date().toISOString().slice(0, 10),
      note: "",
      is_recurring: false,
    });
    load();
  };

  const handleDelete = async (id: number) => {
    await deleteTransaction(id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const filtered = transactions.filter(t => {
    if (filterCategory !== "all" && String(t.category_id) !== filterCategory) return false;
    if (filterType !== "all" && t.type !== filterType) return false;
    return true;
  });

  const fmt = (n: number) => `${sym}${Number(n).toFixed(2)}`;

  return (
    <div className="finance-transactions">
      {/* Quick add form */}
      <div className="finance-add-form">
        <h3>Add Transaction</h3>
        <div className="finance-add-row">
          <select
            value={form.type}
            onChange={e => setForm(f => ({
              ...f,
              type: e.target.value,
              category_id: e.target.value === "income" ? "" : f.category_id,
            }))}
            className="finance-input"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>

          <div
            className={`finance-input finance-amount-display${form.amount ? "" : " placeholder"}`}
            onClick={() => setShowNumpad(true)}
          >
            {form.amount ? `${sym}${form.amount}` : "Amount"}
          </div>

          {form.type === "expense" && (
            <select
              value={form.category_id}
              onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
              className="finance-input"
            >
              <option value="">No category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          )}

          <input
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="finance-input"
          />

          <input
            type="text"
            placeholder="Note (optional)"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            className="finance-input flex-1"
            onKeyDown={e => e.key === "Enter" && handleAdd()}
          />

          <label className="finance-recurring-check" title="Creates a recurring template for next month">
            <input
              type="checkbox"
              checked={form.is_recurring}
              onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))}
            />
            Recurring
          </label>

          <button className="finance-add-btn" onClick={handleAdd}>+ Add</button>
        </div>
      </div>

      {/* Filters */}
      <div className="finance-filters">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="finance-filter-select">
          <option value="all">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="finance-filter-select">
          <option value="all">All categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        <span className="finance-filter-count">{filtered.length} transaction{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="finance-tx-empty">No transactions yet for this period.</div>
      ) : (
        <div className="finance-tx-table">
          <div className="finance-tx-header">
            <span>Date</span>
            <span>Category</span>
            <span>Note</span>
            <span>Type</span>
            <span>Amount</span>
            <span></span>
          </div>
          {filtered.map(tx => (
            <div key={tx.id} className={`finance-tx-row ${tx.type}`}>
              <span className="finance-tx-date">{tx.date}</span>
              <span className="finance-tx-cat">
                {tx.category_icon && <span>{tx.category_icon}</span>}
                {tx.category_name || <span className="muted">—</span>}
              </span>
              <span className="finance-tx-note">{tx.note || <span className="muted">—</span>}</span>
              <span className={`finance-tx-type-badge ${tx.type}`}>{tx.type}</span>
              <span className={`finance-tx-amount ${tx.type}`}>
                {tx.type === "income" ? "+" : "-"}{fmt(tx.amount)}
              </span>
              <span className="finance-tx-actions">
                {tx.is_recurring && <span title="Recurring" className="finance-recurring-badge">🔁</span>}
                <button onClick={() => handleDelete(tx.id)} title="Delete">🗑</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {showNumpad && (
        <div className="finance-numpad-overlay" onClick={() => setShowNumpad(false)}>
          <div className="finance-amount-numpad" onClick={e => e.stopPropagation()}>
            <div className="finance-amount-numpad-display">
              {form.amount ? `${sym}${form.amount}` : `${sym}0`}
            </div>
            <div className="finance-numpad">
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button key={n} className="finance-numpad-btn" onClick={() => handleNumpadKey(String(n))}>{n}</button>
              ))}
              <button className="finance-numpad-btn" onClick={() => handleNumpadKey(".")}>.</button>
              <button className="finance-numpad-btn" onClick={() => handleNumpadKey("0")}>0</button>
              <button className="finance-numpad-btn delete" onClick={() => handleNumpadKey("⌫")}>⌫</button>
            </div>
            <button className="finance-numpad-done" onClick={() => setShowNumpad(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}