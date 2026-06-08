import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, CartesianGrid
} from "recharts";
import { getMonthlySummary, getCategorySpending, getTransactions } from "../financeAPI";
import type { FinanceMonthlySummary, FinanceCategorySpending, FinanceTransaction } from "../types";
import NumberTicker from "./NumberTicker";
import BlurFade from "./BlurFade";
import { currencySymbol } from "./FinanceSettings";
import "./css/FinanceDashboard.css";

interface Props { currentMonth: string; currency: string; }

export default function FinanceDashboard({ currentMonth, currency }: Props) {
  const sym = currencySymbol(currency);
  const [summary, setSummary] = useState<FinanceMonthlySummary | null>(null);
  const [spending, setSpending] = useState<FinanceCategorySpending[]>([]);
  const [recentTx, setRecentTx] = useState<FinanceTransaction[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    Promise.all([
      getMonthlySummary(currentMonth),
      getCategorySpending(currentMonth),
      getTransactions(currentMonth),
    ]).then(([s, sp, tx]) => {
      setSummary(s);
      setSpending(sp);
      setRecentTx(tx.slice(0, 5));
      // Small delay so blur animation is visible
      setTimeout(() => setLoaded(true), 50);
    });
  }, [currentMonth]);

  const overBudgetCount = spending.filter(c => Number(c.spent) > Number(c.monthly_budget) && Number(c.monthly_budget) > 0).length;

  const pieData = spending
    .filter(c => Number(c.spent) > 0)
    .map(c => ({ name: `${c.icon} ${c.name}`, value: Number(c.spent), color: c.color }));

  const barData = spending
    .filter(c => Number(c.monthly_budget) > 0)
    .map(c => ({
      name: `${c.icon} ${c.name}`,
      spent: Number(c.spent),
      budget: Number(c.monthly_budget),
      over: Number(c.spent) > Number(c.monthly_budget),
      color: c.color,
    }));

  return (
    <div className="finance-dashboard">
      {/* Summary strip */}
      <BlurFade inView delay={0} duration={700}>
        <div className="finance-summary-strip">
          <div className="finance-stat-card">
            <span className="finance-stat-label">Carried In</span>
            <span className={`finance-stat-value ${summary && summary.opening_balance < 0 ? "negative" : "positive"}`}>
              {loaded && summary ? (
                <NumberTicker value={Number(summary.opening_balance)} prefix={sym} decimals={2} duration={1800} />
              ) : `${sym}0.00`}
            </span>
          </div>
          <div className="finance-stat-card">
            <span className="finance-stat-label">Income</span>
            <span className="finance-stat-value positive">
              {loaded && summary ? (
                <NumberTicker value={Number(summary.total_income)} prefix={sym} decimals={2} duration={1800} />
              ) : `${sym}0.00`}
            </span>
          </div>
          <div className="finance-stat-card">
            <span className="finance-stat-label">Spent</span>
            <span className="finance-stat-value negative">
              {loaded && summary ? (
                <NumberTicker value={Number(summary.total_expenses)} prefix={sym} decimals={2} duration={1800} />
              ) : `${sym}0.00`}
            </span>
          </div>
          <div className="finance-stat-card highlight">
            <span className="finance-stat-label">Balance</span>
            <span className={`finance-stat-value ${summary && summary.closing_balance < 0 ? "negative" : "positive"}`}>
              {loaded && summary ? (
                <NumberTicker value={Number(summary.closing_balance)} prefix={sym} decimals={2} duration={2200} />
              ) : `${sym}0.00`}
            </span>
          </div>
          {overBudgetCount > 0 && (
            <div className="finance-stat-card warning">
              <span className="finance-stat-label">Over Budget</span>
              <span className="finance-stat-value">{overBudgetCount} categor{overBudgetCount > 1 ? "ies" : "y"}</span>
            </div>
          )}
        </div>
      </BlurFade>

      <div className="finance-charts-grid">
        {barData.length > 0 && (
          <BlurFade inView delay={200} duration={700} className="finance-chart-card wide">
            <h3>Spent vs Budget</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${sym}${v}`} />
                <Tooltip formatter={(v: any) => `${sym}${Number(v).toFixed(2)}`} />
                <Bar dataKey="budget" name="Budget" fill="#e5e7eb" radius={[4,4,0,0]} />
                <Bar dataKey="spent" name="Spent" radius={[4,4,0,0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.over ? "#ef4444" : entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </BlurFade>
        )}

        {pieData.length > 0 && (
          <BlurFade inView delay={350} duration={700} className="finance-chart-card">
            <h3>Spending Breakdown</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => `${sym}${Number(v).toFixed(2)}`} />
                <Legend iconType="circle" iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          </BlurFade>
        )}
      </div>

      {recentTx.length > 0 && (
        <BlurFade inView delay={500} duration={700} className="finance-chart-card">
          <h3>Recent Transactions</h3>
          <div className="finance-recent-list">
            {recentTx.map(tx => (
              <div key={tx.id} className="finance-recent-item">
                <span className="finance-recent-icon">{tx.category_icon || "💰"}</span>
                <div className="finance-recent-info">
                  <span className="finance-recent-note">{tx.note || tx.category_name || "—"}</span>
                  <span className="finance-recent-date">{tx.date}</span>
                </div>
                <span className={`finance-recent-amount ${tx.type === "income" ? "positive" : "negative"}`}>
                  {tx.type === "income" ? "+" : "-"}{sym}{Number(tx.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </BlurFade>
      )}

      {spending.length === 0 && !summary?.total_income && (
        <div className="finance-empty-state">
          <p>🏦 No data yet for this month.</p>
          <p>Add your income and expenses in Transactions, and set up budgets in Budget.</p>
        </div>
      )}
    </div>
  );
}