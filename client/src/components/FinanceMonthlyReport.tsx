import { useEffect, useState } from "react";
import { getMonthlySummary, getCategorySpending, getTransactions, getGoals } from "../financeAPI";
import type { FinanceMonthlySummary, FinanceCategorySpending, FinanceTransaction, FinanceGoal } from "../types";
import { currencySymbol } from "./FinanceSettings";
import "./css/FinanceMonthlyReport.css";

interface Props {
  initialMonth: string;
  currency: string;
}

function shiftMonth(m: string, delta: number): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
}

function todayMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function FinanceMonthlyReport({ initialMonth, currency }: Props) {
  const [month, setMonth] = useState(initialMonth);
  const sym = currencySymbol(currency);

  const [summary, setSummary] = useState<FinanceMonthlySummary | null>(null);
  const [spending, setSpending] = useState<FinanceCategorySpending[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [goals, setGoals] = useState<FinanceGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => { load(); }, [month]);

  const load = async () => {
    setLoading(true);
    setExpanded(new Set());
    const [sum, spend, tx, g] = await Promise.all([
      getMonthlySummary(month).catch(() => null),
      getCategorySpending(month).catch(() => []),
      getTransactions(month).catch(() => []),
      getGoals().catch(() => []),
    ]);
    setSummary(sum);
    setSpending(spend as FinanceCategorySpending[]);
    setTransactions(tx as FinanceTransaction[]);
    setGoals(g as FinanceGoal[]);
    setLoading(false);
  };

  const toggle = (key: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  const fmt = (n: number) => `${sym}${Math.abs(Number(n)).toFixed(2)}`;
  const now = todayMonth();
  const canNext = month < now;

  const regularExpenses = transactions.filter(t => t.type === "expense" && !t.is_goal);
  const incomes = transactions.filter(t => t.type === "income" && !t.is_goal);
  const goalTxs = transactions.filter(t => t.is_goal);

  // Group regular expenses by category
  const catMap = new Map<string, { label: string; icon: string; color: string; catId: number | null; total: number; txs: FinanceTransaction[] }>();
  regularExpenses.forEach(tx => {
    const key = tx.category_id != null ? String(tx.category_id) : "none";
    if (!catMap.has(key)) catMap.set(key, {
      label: tx.category_name || "Uncategorized",
      icon: tx.category_icon || "📌",
      color: tx.category_color || "#9ca3af",
      catId: tx.category_id,
      total: 0, txs: [],
    });
    const g = catMap.get(key)!;
    g.total += Number(tx.amount);
    g.txs.push(tx);
  });
  const catEntries = [...catMap.entries()].sort((a, b) => b[1].total - a[1].total);

  // Group goal transactions by goal name (parsed from note)
  const goalMap = new Map<string, { icon: string; color: string; total: number; txs: FinanceTransaction[]; goal?: FinanceGoal }>();
  goalTxs.forEach(tx => {
    const matched = goals.find(g => tx.note?.includes(g.name));
    const key = matched?.name ?? tx.note ?? "Goal";
    if (!goalMap.has(key)) goalMap.set(key, {
      icon: matched?.icon ?? "🎯",
      color: matched?.color ?? "#6366f1",
      total: 0, txs: [],
      goal: matched,
    });
    const g = goalMap.get(key)!;
    g.total += Number(tx.amount);
    g.txs.push(tx);
  });

  const totalIncome = summary ? Number(summary.total_income) : incomes.reduce((a, t) => a + Number(t.amount), 0);
  const totalExpenses = summary ? Number(summary.total_expenses) : regularExpenses.reduce((a, t) => a + Number(t.amount), 0);
  const opening = summary ? Number(summary.opening_balance) : 0;
  const closing = summary ? Number(summary.closing_balance) : 0;
  const net = totalIncome - totalExpenses;
  const hasData = totalIncome > 0 || totalExpenses > 0 || goalTxs.length > 0;

  return (
    <div className="fmr-root">
      {/* Month navigation */}
      <div className="fmr-month-nav">
        <button className="fmr-nav-btn" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <span className="fmr-month-label">{monthLabel(month)}</span>
        <button className="fmr-nav-btn" onClick={() => setMonth(shiftMonth(month, 1))} disabled={!canNext}>›</button>
      </div>

      {loading && <div className="fmr-loading">Loading…</div>}

      {!loading && !hasData && (
        <div className="fmr-empty">
          <span className="fmr-empty-icon">📊</span>
          <p>No data for {monthLabel(month)}</p>
          <span>Add transactions to see your monthly report.</span>
        </div>
      )}

      {!loading && hasData && (
        <>
          {/* Summary bar */}
          <div className="fmr-summary-bar">
            <div className="fmr-stat">
              <span className="fmr-stat-label">Opening</span>
              <span className="fmr-stat-value neutral">{fmt(opening)}</span>
            </div>
            <div className="fmr-stat">
              <span className="fmr-stat-label">Income</span>
              <span className="fmr-stat-value income">+{fmt(totalIncome)}</span>
            </div>
            <div className="fmr-stat">
              <span className="fmr-stat-label">Spent</span>
              <span className="fmr-stat-value expense">-{fmt(totalExpenses)}</span>
            </div>
            <div className="fmr-stat">
              <span className="fmr-stat-label">Balance</span>
              <span className={`fmr-stat-value ${closing >= 0 ? "income" : "expense"}`}>{fmt(closing)}</span>
            </div>
          </div>

          <div className={`fmr-net-banner ${net >= 0 ? "saved" : "overspent"}`}>
            {net >= 0
              ? `You saved ${fmt(net)} this month`
              : `You overspent by ${fmt(net)} this month`}
          </div>

          {/* Spending by category */}
          {catEntries.length > 0 && (
            <section className="fmr-section">
              <h3 className="fmr-section-title">Spending by Category</h3>
              {catEntries.map(([key, cat]) => {
                const budgetRow = spending.find(s => cat.catId != null && s.id === cat.catId);
                const budget = budgetRow ? Number(budgetRow.monthly_budget) : 0;
                const pct = budget > 0 ? Math.min((cat.total / budget) * 100, 100) : 0;
                const over = budget > 0 && cat.total > budget;
                const open = expanded.has(key);
                return (
                  <div key={key} className="fmr-card">
                    <div className="fmr-card-header" onClick={() => toggle(key)}>
                      <span className="fmr-cat-icon" style={{ background: cat.color + "22", color: cat.color }}>{cat.icon}</span>
                      <div className="fmr-cat-meta">
                        <span className="fmr-cat-name">{cat.label}</span>
                        {budget > 0 && (
                          <div className="fmr-bar-row">
                            <div className="fmr-bar"><div className="fmr-bar-fill" style={{ width: `${pct}%`, background: over ? "#ef4444" : cat.color }} /></div>
                            <span className={`fmr-bar-pct ${over ? "over" : ""}`}>{pct.toFixed(0)}%</span>
                          </div>
                        )}
                      </div>
                      <div className="fmr-cat-right">
                        <span className={`fmr-cat-total ${over ? "over" : ""}`}>{fmt(cat.total)}</span>
                        {budget > 0 && <span className="fmr-cat-budget">/ {fmt(budget)}</span>}
                      </div>
                      <span className="fmr-chevron">{open ? "▲" : "▼"}</span>
                    </div>
                    {open && (
                      <div className="fmr-tx-list">
                        {cat.txs.sort((a, b) => Number(b.amount) - Number(a.amount)).map(tx => (
                          <div key={tx.id} className="fmr-tx-row">
                            <span className="fmr-tx-date">{tx.date}</span>
                            <span className="fmr-tx-note">{tx.note || "—"}</span>
                            <span className="fmr-tx-amt expense">-{fmt(tx.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {/* Income */}
          {incomes.length > 0 && (
            <section className="fmr-section">
              <h3 className="fmr-section-title">Income</h3>
              <div className="fmr-card">
                <div className="fmr-card-header" onClick={() => toggle("income")}>
                  <span className="fmr-cat-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>💰</span>
                  <div className="fmr-cat-meta">
                    <span className="fmr-cat-name">{incomes.length} transaction{incomes.length > 1 ? "s" : ""}</span>
                  </div>
                  <span className="fmr-cat-total income" style={{ marginLeft: "auto" }}>{fmt(totalIncome)}</span>
                  <span className="fmr-chevron">{expanded.has("income") ? "▲" : "▼"}</span>
                </div>
                {expanded.has("income") && (
                  <div className="fmr-tx-list">
                    {incomes.sort((a, b) => Number(b.amount) - Number(a.amount)).map(tx => (
                      <div key={tx.id} className="fmr-tx-row">
                        <span className="fmr-tx-date">{tx.date}</span>
                        <span className="fmr-tx-note">{tx.note || tx.category_name || "Income"}</span>
                        <span className="fmr-tx-amt income">+{fmt(tx.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Goals activity */}
          {goalMap.size > 0 && (
            <section className="fmr-section">
              <h3 className="fmr-section-title">Goals Activity</h3>
              {[...goalMap.entries()].map(([name, g]) => {
                const progress = g.goal
                  ? Math.min((Number(g.goal.current_amount) / Number(g.goal.target_amount)) * 100, 100)
                  : 0;
                const key = `goal-${name}`;
                const open = expanded.has(key);
                return (
                  <div key={key} className="fmr-card">
                    <div className="fmr-card-header" onClick={() => toggle(key)}>
                      <span className="fmr-cat-icon" style={{ background: g.color + "22", color: g.color }}>{g.icon}</span>
                      <div className="fmr-cat-meta">
                        <span className="fmr-cat-name">{name}</span>
                        {g.goal && (
                          <div className="fmr-bar-row">
                            <div className="fmr-bar"><div className="fmr-bar-fill" style={{ width: `${progress}%`, background: g.color }} /></div>
                            <span className="fmr-bar-pct">{progress.toFixed(0)}% of goal</span>
                          </div>
                        )}
                      </div>
                      <div className="fmr-cat-right">
                        <span className="fmr-cat-total">{fmt(g.total)}</span>
                        <span className="fmr-cat-budget">this month</span>
                      </div>
                      <span className="fmr-chevron">{open ? "▲" : "▼"}</span>
                    </div>
                    {open && (
                      <div className="fmr-tx-list">
                        {g.txs.map(tx => (
                          <div key={tx.id} className="fmr-tx-row">
                            <span className="fmr-tx-date">{tx.date}</span>
                            <span className="fmr-tx-note">{tx.note || "—"}</span>
                            <span className="fmr-tx-amt">{fmt(tx.amount)}</span>
                          </div>
                        ))}
                        {g.goal && (
                          <div className="fmr-goal-footer">
                            Total saved: {fmt(g.goal.current_amount)} of {fmt(g.goal.target_amount)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}
    </div>
  );
}
