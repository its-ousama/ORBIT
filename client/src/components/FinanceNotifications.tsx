import { useEffect, useState } from "react";
import {
  getPendingRecurring, createTransaction, skipRecurring,
  getCategorySpending, getGoals, getMonthlySummary, getTransactions
} from "../financeAPI";

import "./css/FinanceNotifications.css";

interface Props {
  currentMonth: string;
  onConfirmed: () => void;
}

type NotifType = "recurring" | "over_budget" | "near_budget" | "goal_milestone" | "month_summary" | "no_income";

interface Notification {
  id: string;
  type: NotifType;
  icon: string;
  title: string;
  body: string;
  color: string;
  action?: () => void;
  actionLabel?: string;
  skipAction?: () => void;
}

export default function FinanceNotifications({ currentMonth, onConfirmed }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => { load(); }, [currentMonth]);

  const load = async () => {
    setLoading(true);
    const [pending, spending, goals, summary, transactions] = await Promise.all([
      getPendingRecurring(currentMonth),
      getCategorySpending(currentMonth),
      getGoals(),
      getMonthlySummary(currentMonth),
      getTransactions(currentMonth),
    ]);

    const notifs: Notification[] = [];

    // ── Recurring confirmations ──────────────────────────────────────────────
    pending.forEach(r => {
      notifs.push({
        id: `recurring-${r.id}`,
        type: "recurring",
        icon: r.category_icon || "🔁",
        title: `Recurring: ${r.title}`,
        body: `${r.category_name || "No category"} · Due on the ${r.day_of_month}${ordinal(r.day_of_month)} · ${r.type === "income" ? "+" : "-"}€${Number(r.amount).toFixed(2)}`,
        color: r.category_color || "#6366f1",
        action: async () => {
          setConfirming(`recurring-${r.id}`);
          const day = String(r.day_of_month).padStart(2, "0");
          await createTransaction({
            amount: r.amount, type: r.type, category_id: r.category_id,
            date: `${currentMonth}-${day}`, note: r.title,
            is_recurring: true, recurring_id: r.id,
          });
          setNotifications(prev => prev.filter(n => n.id !== `recurring-${r.id}`));
          setConfirming(null);
          onConfirmed();
        },
        actionLabel: "Confirm",
        skipAction: async () => {
          await skipRecurring(r.id, currentMonth);
          setNotifications(prev => prev.filter(n => n.id !== `recurring-${r.id}`));
          onConfirmed();
        },
      });
    });

    // ── Over budget alerts ───────────────────────────────────────────────────
    spending.forEach(cat => {
      const spent = Number(cat.spent);
      const budget = Number(cat.monthly_budget);
      if (budget > 0 && spent > budget) {
        const over = spent - budget;
        notifs.push({
          id: `over-${cat.id}`,
          type: "over_budget",
          icon: cat.icon,
          title: `Over budget: ${cat.name}`,
          body: `You've exceeded your ${cat.name} budget by €${over.toFixed(2)} (spent €${spent.toFixed(2)} of €${budget.toFixed(2)})`,
          color: "#ef4444",
        });
      }
    });

    // ── Near budget warnings (80%+) ──────────────────────────────────────────
    spending.forEach(cat => {
      const spent = Number(cat.spent);
      const budget = Number(cat.monthly_budget);
      const pct = budget > 0 ? (spent / budget) * 100 : 0;
      if (budget > 0 && pct >= 80 && pct < 100) {
        notifs.push({
          id: `near-${cat.id}`,
          type: "near_budget",
          icon: cat.icon,
          title: `Approaching limit: ${cat.name}`,
          body: `You've used ${pct.toFixed(0)}% of your ${cat.name} budget — €${(budget - spent).toFixed(2)} remaining`,
          color: "#f59e0b",
        });
      }
    });

    // ── Goal milestones ──────────────────────────────────────────────────────
    goals.forEach(goal => {
      const pct = Number(goal.target_amount) > 0
        ? (Number(goal.current_amount) / Number(goal.target_amount)) * 100
        : 0;
      if (pct >= 100) {
        notifs.push({
          id: `goal-done-${goal.id}`,
          type: "goal_milestone",
          icon: goal.icon,
          title: `Goal achieved: ${goal.name}! 🎉`,
          body: `You've reached your target of €${Number(goal.target_amount).toFixed(2)}. Congratulations!`,
          color: "#10b981",
        });
      } else if (pct >= 75) {
        notifs.push({
          id: `goal-75-${goal.id}`,
          type: "goal_milestone",
          icon: goal.icon,
          title: `75% there: ${goal.name}`,
          body: `€${Number(goal.current_amount).toFixed(2)} saved of €${Number(goal.target_amount).toFixed(2)} — almost there!`,
          color: goal.color,
        });
      } else if (pct >= 50) {
        notifs.push({
          id: `goal-50-${goal.id}`,
          type: "goal_milestone",
          icon: goal.icon,
          title: `Halfway: ${goal.name}`,
          body: `€${Number(goal.current_amount).toFixed(2)} saved of €${Number(goal.target_amount).toFixed(2)} — keep going!`,
          color: goal.color,
        });
      }
    });

    // ── No income logged yet ─────────────────────────────────────────────────
    const today = new Date();
    const currentMonthNow = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const dayOfMonth = today.getDate();
    const hasIncome = transactions.some(t => t.type === "income");
    if (currentMonth === currentMonthNow && dayOfMonth > 5 && !hasIncome) {
      notifs.push({
        id: "no-income",
        type: "no_income",
        icon: "💸",
        title: "No income logged this month",
        body: "You haven't logged any income for this month yet. Don't forget to add your paycheck(s).",
        color: "#8b5cf6",
      });
    }

    // ── Month summary (if we're looking at a past month) ─────────────────────
    if (currentMonth < currentMonthNow) {
      const balance = Number(summary.closing_balance);
      const income = Number(summary.total_income);
      const expenses = Number(summary.total_expenses);
      notifs.push({
        id: `summary-${currentMonth}`,
        type: "month_summary",
        icon: "📅",
        title: `${monthLabel(currentMonth)} summary`,
        body: `Income: €${income.toFixed(2)} · Spent: €${expenses.toFixed(2)} · Closed with €${balance.toFixed(2)} balance`,
        color: balance >= 0 ? "#10b981" : "#ef4444",
      });
    }

    setNotifications(notifs);
    setLoading(false);
  };

  if (loading) return <div className="finance-notif-page"><div className="finance-notif-loading">Loading...</div></div>;

  const recurringNotifs = notifications.filter(n => n.type === "recurring");
  const alertNotifs = notifications.filter(n => n.type !== "recurring");

  return (
    <div className="finance-notif-page">
      <div className="finance-notif-header">
        <h2>Notifications</h2>
        <span className="finance-notif-total">
          {notifications.length > 0 ? `${notifications.length} notification${notifications.length > 1 ? "s" : ""}` : "All clear"}
        </span>
      </div>

      {notifications.length === 0 && (
        <div className="finance-notif-all-clear">
          <span>✅</span>
          <p>You're all caught up!</p>
          <span>No pending actions or alerts for {monthLabel(currentMonth)}.</span>
        </div>
      )}

      {/* Recurring confirmations */}
      {recurringNotifs.length > 0 && (
        <div className="finance-notif-group">
          <div className="finance-notif-group-label">🔁 Recurring — needs confirmation</div>
          {recurringNotifs.map(n => (
            <NotifCard key={n.id} notif={n} confirming={confirming} />
          ))}
        </div>
      )}

      {/* Alerts */}
      {alertNotifs.length > 0 && (
        <div className="finance-notif-group">
          <div className="finance-notif-group-label">⚡ Alerts</div>
          {alertNotifs.map(n => (
            <NotifCard key={n.id} notif={n} confirming={confirming} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotifCard({ notif, confirming }: { notif: Notification; confirming: string | null }) {
  return (
    <div className="finance-notif-card" style={{ borderLeftColor: notif.color }}>
      <div className="finance-notif-card-left">
        <span className="finance-notif-card-icon" style={{ background: notif.color + "18", color: notif.color }}>
          {notif.icon}
        </span>
        <div className="finance-notif-card-text">
          <span className="finance-notif-card-title">{notif.title}</span>
          <span className="finance-notif-card-body">{notif.body}</span>
        </div>
      </div>
      {(notif.action || notif.skipAction) && (
        <div className="finance-notif-card-actions">
          {notif.action && (
            <button
              className="finance-notif-confirm-btn"
              onClick={notif.action}
              disabled={confirming === notif.id}
            >
              {confirming === notif.id ? "..." : notif.actionLabel || "Confirm"}
            </button>
          )}
          {notif.skipAction && (
            <button className="finance-notif-skip-btn" onClick={notif.skipAction}>
              Skip
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ordinal(n: number): string {
  if (n > 3 && n < 21) return "th";
  switch (n % 10) {
    case 1: return "st"; case 2: return "nd"; case 3: return "rd"; default: return "th";
  }
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
}