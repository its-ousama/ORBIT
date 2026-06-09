import { useEffect, useState } from "react";
import {  createCategory, updateCategory, deleteCategory, getCategorySpending, getRecurring, deleteRecurring } from "../financeAPI";
import type { FinanceCategorySpending, FinanceRecurring } from "../types";
import { currencySymbol } from "./FinanceSettings";
import "./css/FinanceBudget.css";

const PRESET_COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#14b8a6"];
const PRESET_ICONS = ["🏠","🍔","🚗","💊","🎮","✈️","👕","📱","💡","🎓","💰","🎁","🐾","🏋️"];

interface Props { currentMonth: string; currency: string; }

export default function FinanceBudget({ currentMonth, currency }: Props) {
  const sym = currencySymbol(currency);
  const [spending, setSpending] = useState<FinanceCategorySpending[]>([]);
  const [recurring, setRecurring] = useState<FinanceRecurring[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", icon: "💰", color: "#6366f1", monthly_budget: "" });
  const [showEmojiInput, setShowEmojiInput] = useState(false);

  useEffect(() => { loadSpending(); loadRecurring(); }, [currentMonth]);

  const loadSpending = () => getCategorySpending(currentMonth).then(setSpending);
  const loadRecurring = () => getRecurring().then(setRecurring);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const data = {
      name: form.name, icon: form.icon, color: form.color,
      monthly_budget: Number(form.monthly_budget) || 0,
      type: "expense" as const,
    };
    if (editingId) {
      await updateCategory(editingId, data);
    } else {
      await createCategory(data);
    }
    setForm({ name: "", icon: "💰", color: "#6366f1", monthly_budget: "" });
    setShowForm(false);
    setEditingId(null);
    loadSpending();
  };

  const handleEdit = (c: FinanceCategorySpending) => {
    setForm({ name: c.name, icon: c.icon, color: c.color, monthly_budget: String(c.monthly_budget) });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this category? Transactions will remain but lose their category.")) return;
    await deleteCategory(id);
    loadSpending();
  };

  const handleDeleteRecurring = async (id: number) => {
    if (!confirm("Stop this recurring transaction permanently?")) return;
    await deleteRecurring(id);
    setRecurring(prev => prev.filter(r => r.id !== id));
  };

  const totalBudget = spending.reduce((a, c) => a + Number(c.monthly_budget), 0);
  const totalSpent = spending.reduce((a, c) => a + Number(c.spent), 0);
  const fmt = (n: number) => `${sym}${Number(n).toFixed(2)}`;

  return (
    <div className="finance-budget">
      {/* Budget header */}
      <div className="finance-budget-header">
        <div className="finance-budget-totals">
          <div className="finance-budget-total-item">
            <span>Total Budgeted</span>
            <strong>{fmt(totalBudget)}</strong>
          </div>
          <div className="finance-budget-total-item">
            <span>Total Spent</span>
            <strong className={totalSpent > totalBudget ? "negative" : ""}>{fmt(totalSpent)}</strong>
          </div>
          <div className="finance-budget-total-item">
            <span>Remaining</span>
            <strong className={totalBudget - totalSpent < 0 ? "negative" : "positive"}>{fmt(totalBudget - totalSpent)}</strong>
          </div>
        </div>
        <button className="finance-add-cat-btn" onClick={() => {
          setShowForm(true); setEditingId(null);
          setForm({ name: "", icon: "💰", color: "#6366f1", monthly_budget: "" });
        }}>
          + New Category
        </button>
      </div>

      {/* Category form */}
      {showForm && (
        <div className="finance-cat-form">
          <h3>{editingId ? "Edit Category" : "New Category"}</h3>
          <div className="finance-cat-form-row">
            <div>
              <label>Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Groceries" className="finance-input" />
            </div>
            <div>
              <label>Monthly Budget ({sym})</label>
              <input type="number" value={form.monthly_budget} onChange={e => setForm(f => ({ ...f, monthly_budget: e.target.value }))} placeholder="0" className="finance-input" min="0" step="0.01" />
            </div>
          </div>
          <div>
            <label>Icon</label>
            <div className="finance-icon-picker">
              {PRESET_ICONS.map(icon => (
                <button key={icon} className={`finance-icon-btn ${form.icon === icon ? "selected" : ""}`}
                  onClick={() => { setForm(f => ({ ...f, icon })); setShowEmojiInput(false); }}>{icon}</button>
              ))}
              {!PRESET_ICONS.includes(form.icon) && (
                <button className="finance-icon-btn selected" onClick={() => setShowEmojiInput(true)}>{form.icon}</button>
              )}
              {showEmojiInput ? (
                <input
                  className="finance-icon-emoji-input"
                  placeholder="✦"
                  autoComplete="off"
                  onChange={e => {
                    const chars = [...e.target.value];
                    const emoji = chars[chars.length - 1];
                    if (emoji) { setForm(f => ({ ...f, icon: emoji })); setShowEmojiInput(false); }
                  }}
                  onBlur={() => setShowEmojiInput(false)}
                  onKeyDown={e => { if (e.key === "Escape") setShowEmojiInput(false); }}
                />
              ) : (
                <button className="finance-icon-btn finance-icon-add-btn" onClick={() => setShowEmojiInput(true)} title="Add custom emoji">+</button>
              )}
            </div>
          </div>
          <div>
            <label>Color</label>
            <div className="finance-color-picker">
              {PRESET_COLORS.map(color => (
                <button key={color} className={`finance-color-swatch ${form.color === color ? "selected" : ""}`}
                  style={{ background: color }} onClick={() => setForm(f => ({ ...f, color }))} />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                onInput={e => setForm(f => ({ ...f, color: (e.target as HTMLInputElement).value }))}
                className={`finance-color-custom ${!PRESET_COLORS.includes(form.color) ? "active" : ""}`}
              />
            </div>
          </div>
          <div className="finance-cat-form-actions">
            <button className="finance-save-btn" onClick={handleSave}>Save</button>
            <button className="finance-cancel-btn" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Category list */}
      {spending.length === 0 ? (
        <div className="finance-budget-empty">No categories yet. Create one to start tracking your budget.</div>
      ) : (
        <div className="finance-cat-list">
          {spending.map(cat => {
            const budget = Number(cat.monthly_budget);
            const spent = Number(cat.spent);
            const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
            const over = budget > 0 && spent > budget;
            return (
              <div key={cat.id} className="finance-cat-row">
                <div className="finance-cat-info">
                  <span className="finance-cat-icon" style={{ background: cat.color + "22", color: cat.color }}>{cat.icon}</span>
                  <div>
                    <span className="finance-cat-name">{cat.name}</span>
                  </div>
                </div>
                <div className="finance-cat-progress-wrap">
                  <div className="finance-cat-progress-bar">
                    <div className={`finance-cat-progress-fill ${over ? "over" : ""}`}
                      style={{ width: `${pct}%`, background: over ? "#ef4444" : cat.color }} />
                  </div>
                  <div className="finance-cat-amounts">
                    <span className={over ? "negative" : ""}>{fmt(spent)}</span>
                    <span className="muted">/ {fmt(budget)}</span>
                  </div>
                </div>
                <div className="finance-cat-actions">
                  <button onClick={() => handleEdit(cat)}>✏️</button>
                  <button onClick={() => handleDelete(cat.id)}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recurring templates section */}
      <div className="finance-recurring-section">
        <div className="finance-recurring-section-header">
          <h3>🔁 Recurring Transactions</h3>
          <span className="finance-recurring-count">{recurring.length} active</span>
        </div>
        {recurring.length === 0 ? (
          <div className="finance-recurring-empty">
            No recurring transactions set up yet. Mark a transaction as recurring when adding it in Transactions.
          </div>
        ) : (
          <div className="finance-recurring-list">
            {recurring.map(r => (
              <div key={r.id} className="finance-recurring-row">
                <span className="finance-recurring-icon"
                  style={{ background: (r.category_color || "#6366f1") + "22", color: r.category_color || "#6366f1" }}>
                  {r.category_icon || "🔁"}
                </span>
                <div className="finance-recurring-info">
                  <span className="finance-recurring-title">{r.title}</span>
                  <span className="finance-recurring-meta">
                    {r.category_name || "No category"} · Every {r.day_of_month}{ordinal(r.day_of_month)} of the month
                  </span>
                </div>
                <span className={`finance-recurring-amount ${r.type}`}>
                  {r.type === "income" ? "+" : "-"}{sym}{Number(r.amount).toFixed(2)}
                </span>
                <button className="finance-recurring-delete" onClick={() => handleDeleteRecurring(r.id)} title="Stop recurring">🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  if (n > 3 && n < 21) return "th";
  switch (n % 10) {
    case 1: return "st"; case 2: return "nd"; case 3: return "rd"; default: return "th";
  }
}