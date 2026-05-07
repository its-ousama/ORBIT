import { useEffect, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import { getMonthlySummary, getCategorySpending, getGoals, getPendingRecurring, getTransactions } from "../financeAPI";
import "./css/NotificationsPage.css";

export type AppDestination =
  | { app: "finance"; section: "notifications" }
  | { app: "finance"; section: "goals" }
  | { app: "finance"; section: "budget" }
  | { app: "finance"; section: "transactions" }
  | { app: "tasks"; date: string }
  | { app: "week" }
  | { app: "journal" };

export interface AppNotification {
  id: string;
  app: string;
  appIcon: string;
  appColor: string;
  title: string;
  body: string;
  priority: "high" | "medium" | "low";
  timestamp: number;
  destination: AppDestination;
}

interface Props {
  onNavigate: (app: string, extra?: any) => void;
}

const DISMISSED_KEY = "gp_dismissed_notifs";

function getDismissed(): string[] {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"); }
  catch { return []; }
}

function saveDismissed(ids: string[]) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
}

export default function NotificationsPage({ onNavigate }: Props) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(getDismissed());
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState<string | null>(null);

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const today = dayjs().format("YYYY-MM-DD");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const notifs: AppNotification[] = [];

    // ── Finance notifications ───────────────────────────────────────────────
    try {
      const [pending, spending, goals, summary, txs] = await Promise.all([
        getPendingRecurring(currentMonth),
        getCategorySpending(currentMonth),
        getGoals(),
        getMonthlySummary(currentMonth),
        getTransactions(currentMonth),
      ]);

      // Recurring pending
      pending.forEach(r => {
        notifs.push({
          id: `recurring-${r.id}-${currentMonth}`,
          app: "Finance", appIcon: "💳", appColor: "#10b981",
          title: `Recurring payment pending`,
          body: `${r.title} — €${Number(r.amount).toFixed(2)} due on the ${r.day_of_month}th`,
          priority: "high",
          timestamp: Date.now(),
          destination: { app: "finance", section: "notifications" },
        });
      });

      // Over budget
      spending.forEach(cat => {
        const spent = Number(cat.spent);
        const budget = Number(cat.monthly_budget);
        if (budget > 0 && spent > budget) {
          notifs.push({
            id: `overbudget-${cat.id}-${currentMonth}`,
            app: "Finance", appIcon: "💳", appColor: "#10b981",
            title: `Over budget: ${cat.name}`,
            body: `Spent €${spent.toFixed(2)} of €${budget.toFixed(2)} (${((spent/budget)*100).toFixed(0)}%)`,
            priority: "high",
            timestamp: Date.now() - 1000,
            destination: { app: "finance", section: "budget" },
          });
        } else if (budget > 0 && spent / budget >= 0.8) {
          notifs.push({
            id: `nearbudget-${cat.id}-${currentMonth}`,
            app: "Finance", appIcon: "💳", appColor: "#10b981",
            title: `Approaching limit: ${cat.name}`,
            body: `${((spent/budget)*100).toFixed(0)}% used — €${(budget-spent).toFixed(2)} remaining`,
            priority: "medium",
            timestamp: Date.now() - 2000,
            destination: { app: "finance", section: "budget" },
          });
        }
      });

      // Goal deadlines in next 7 days
      goals.forEach(goal => {
        if (!goal.deadline) return;
        const days = Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const pct = (Number(goal.current_amount) / Number(goal.target_amount)) * 100;
        if (days >= 0 && days <= 7 && pct < 100) {
          notifs.push({
            id: `goal-deadline-${goal.id}`,
            app: "Finance", appIcon: "💳", appColor: "#10b981",
            title: `Goal deadline: ${goal.name}`,
            body: `${days === 0 ? "Today!" : `${days} day${days > 1 ? "s" : ""} left`} — ${pct.toFixed(0)}% saved`,
            priority: days <= 2 ? "high" : "medium",
            timestamp: Date.now() - 3000,
            destination: { app: "finance", section: "goals" },
          });
        }
      });

      // No income this month (past 5th)
      const hasIncome = txs.some(t => t.type === "income");
      if (!hasIncome && new Date().getDate() > 5) {
        notifs.push({
          id: `no-income-${currentMonth}`,
          app: "Finance", appIcon: "💳", appColor: "#10b981",
          title: "No income logged this month",
          body: "You haven't added any income for this month yet",
          priority: "medium",
          timestamp: Date.now() - 4000,
          destination: { app: "finance", section: "transactions" },
        });
      }
    } catch {}

    // ── Tasks notifications ─────────────────────────────────────────────────
    try {
      const res = await axios.get("http://localhost:3001/api/tasks");
      const allTasks = res.data;

      // Overdue — pending tasks from previous days
      const overdue = allTasks.filter((t: any) =>
        t.status === "pending" && t.date < today
      );
      const overdueByDate: Record<string, any[]> = {};
      overdue.forEach((t: any) => {
        if (!overdueByDate[t.date]) overdueByDate[t.date] = [];
        overdueByDate[t.date].push(t);
      });

      Object.entries(overdueByDate).slice(0, 5).forEach(([date, tasks]) => {
        const highCount = (tasks as any[]).filter(t => t.priority === "high").length;
        notifs.push({
          id: `overdue-${date}`,
          app: "Tasks", appIcon: "✓", appColor: "#6366f1",
          title: `${tasks.length} overdue task${tasks.length > 1 ? "s" : ""} from ${dayjs(date).format("MMM D")}`,
          body: highCount > 0 ? `${highCount} high priority` : "Tap to review",
          priority: highCount > 0 ? "high" : "medium",
          timestamp: Date.now() - 5000,
          destination: { app: "tasks", date },
        });
      });

      // Today's high priority tasks
      const todayHigh = allTasks.filter((t: any) =>
        t.date === today && t.status === "pending" && t.priority === "high"
      );
      if (todayHigh.length > 0) {
        notifs.push({
          id: `today-high-${today}`,
          app: "Tasks", appIcon: "✓", appColor: "#6366f1",
          title: `${todayHigh.length} high priority task${todayHigh.length > 1 ? "s" : ""} today`,
          body: todayHigh.map((t: any) => t.title).slice(0, 2).join(", "),
          priority: "high",
          timestamp: Date.now() - 500,
          destination: { app: "tasks", date: today },
        });
      }
    } catch {}

    // ── This Week notifications ─────────────────────────────────────────────
    try {
      const res = await axios.get("http://localhost:3001/api/schedule", {
        params: { start: today, end: today }
      });
      const todayEvents = res.data;

      if (todayEvents.length > 0) {
        // Events starting in next 2 hours
        const now = dayjs();
        const soon = todayEvents.filter((e: any) => {
          if (!e.start_time) return false;
          const eventTime = dayjs(`${today} ${e.start_time}`);
          const diff = eventTime.diff(now, "minute");
          return diff >= 0 && diff <= 120;
        });

        if (soon.length > 0) {
          soon.forEach((e: any) => {
            const diff = dayjs(`${today} ${e.start_time}`).diff(now, "minute");
            notifs.push({
              id: `event-soon-${e.id}`,
              app: "This Week", appIcon: "▦", appColor: "#3b82f6",
              title: `${e.title} starting soon`,
              body: diff === 0 ? "Starting now" : `In ${diff} minute${diff > 1 ? "s" : ""} at ${e.start_time}`,
              priority: "high",
              timestamp: Date.now() - 100,
              destination: { app: "week" },
            });
          });
        } else {
          notifs.push({
            id: `today-events-${today}`,
            app: "This Week", appIcon: "▦", appColor: "#3b82f6",
            title: `${todayEvents.length} event${todayEvents.length > 1 ? "s" : ""} today`,
            body: todayEvents.map((e: any) => e.title).slice(0, 2).join(", "),
            priority: "low",
            timestamp: Date.now() - 6000,
            destination: { app: "week" },
          });
        }
      }
    } catch {}

    // Sort by priority then timestamp
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    notifs.sort((a, b) =>
      priorityOrder[a.priority] - priorityOrder[b.priority] ||
      b.timestamp - a.timestamp
    );

    setNotifications(notifs);
    setLoading(false);
  };

  const dismiss = (id: string) => {
    const updated = [...dismissed, id];
    setDismissed(updated);
    saveDismissed(updated);
  };

  const handleTap = (notif: AppNotification) => {
    dismiss(notif.id);
    onNavigate(notif.destination.app, notif.destination);
  };

  const handleSwipe = (id: string) => {
    setSwiping(id);
    setTimeout(() => {
      dismiss(id);
      setSwiping(null);
    }, 300);
  };

  const visible = notifications.filter(n => !dismissed.includes(n.id));
  const unread = visible.length;

  const priorityColor = { high: "#ef4444", medium: "#f59e0b", low: "#94a3b8" };
  const priorityLabel = { high: "Urgent", medium: "Notice", low: "Info" };

  if (loading) {
    return (
      <div className="notif-page">
        <div className="notif-header">
          <h1>Notifications</h1>
        </div>
        <div className="notif-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="notif-page">
      <div className="notif-header">
        <div>
          <h1>Notifications</h1>
          <p className="notif-sub">{unread > 0 ? `${unread} unread` : "All clear"}</p>
        </div>
        {unread > 0 && (
          <button className="notif-clear-all" onClick={() => {
            const allIds = visible.map(n => n.id);
            const updated = [...dismissed, ...allIds];
            setDismissed(updated);
            saveDismissed(updated);
          }}>
            Clear all
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="notif-empty">
          <div className="notif-empty-icon">🎉</div>
          <p>You're all caught up!</p>
          <span>No new notifications right now.</span>
        </div>
      ) : (
        <div className="notif-list">
          {visible.map(notif => (
            <div
              key={notif.id}
              className={`notif-card ${swiping === notif.id ? "swiping" : ""}`}
              style={{ "--notif-color": notif.appColor } as React.CSSProperties}
            >
              <div className="notif-card-inner" onClick={() => handleTap(notif)}>
                <div className="notif-app-icon" style={{ background: notif.appColor + "18", color: notif.appColor }}>
                  {notif.appIcon}
                </div>
                <div className="notif-content">
                  <div className="notif-meta">
                    <span className="notif-app-name">{notif.app}</span>
                    <span className="notif-priority" style={{ color: priorityColor[notif.priority] }}>
                      {priorityLabel[notif.priority]}
                    </span>
                  </div>
                  <div className="notif-title">{notif.title}</div>
                  <div className="notif-body">{notif.body}</div>
                </div>
                <div className="notif-arrow">›</div>
              </div>
              <button
                className="notif-dismiss"
                onClick={(e) => { e.stopPropagation(); handleSwipe(notif.id); }}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}