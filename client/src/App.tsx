import { useState, useEffect } from "react";
import dayjs from "dayjs";
import http from "./http";
import TasksPage from "./components/TasksPage";
import CalendarPage from "./components/CalendarPage";
import DocumentationPage from "./components/DocumentationPage";
import BoardsPage from "./components/BoardsPage";
import WeekPage from "./components/WeekPage";
import JournalPage from "./components/JournalPage";
import FinancePage from "./components/FinancePage";
import GalaxyHome from "./components/GalaxyHome";
import HomeButton from "./components/HomeButton";
import NotificationsPage from "./components/NotificationsPage";
import LoginPage from "./components/LoginPage";
import { getPendingRecurring, getCategorySpending, getTransactions } from "./financeAPI";
import "./App.css";

export type Page = "home" | "tasks" | "calendar" | "documentation" | "boards" | "week" | "journal" | "finance" | "notifications";

interface AuthUser { id: number; email: string; username: string; }

function getStoredUser(): AuthUser | null {
  try { return JSON.parse(localStorage.getItem("orbit_user") || "null"); } catch { return null; }
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = localStorage.getItem("orbit_token");
    return token ? getStoredUser() : null;
  });

  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [page, setPage] = useState<Page>("home");
  const [notifCount, setNotifCount] = useState(0);
  const [financeSection, setFinanceSection] = useState<string | undefined>(undefined);

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const today = dayjs().format("YYYY-MM-DD");

  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener("orbit_logout", handler);
    return () => window.removeEventListener("orbit_logout", handler);
  }, []);

  useEffect(() => {
    if (user) countNotifications();
  }, [user]);

  const handleLogin = (u: AuthUser) => {
    setUser(u);
    setPage("home");
  };

  const handleLogout = () => {
    localStorage.removeItem("orbit_token");
    localStorage.removeItem("orbit_refresh");
    localStorage.removeItem("orbit_user");
    setUser(null);
  };

  const countNotifications = async () => {
    const dismissed: string[] = JSON.parse(localStorage.getItem("gp_dismissed_notifs") || "[]");
    let count = 0;

    try {
      const [pending, spending, goals, txs, tasksRes, scheduleRes] = await Promise.all([
        getPendingRecurring(currentMonth),
        getCategorySpending(currentMonth),
        (await import("./financeAPI")).getGoals(),
        getTransactions(currentMonth),
        http.get("/tasks"),
        http.get("/schedule", { params: { start: today, end: today } }),
      ]);

      const ids: string[] = [];
      pending.forEach(r => ids.push(`recurring-${r.id}-${currentMonth}`));
      spending.forEach(cat => {
        const spent = Number(cat.spent), budget = Number(cat.monthly_budget);
        if (budget > 0 && spent > budget) ids.push(`overbudget-${cat.id}-${currentMonth}`);
        else if (budget > 0 && spent / budget >= 0.8) ids.push(`nearbudget-${cat.id}-${currentMonth}`);
      });
      goals.forEach((g: any) => {
        if (!g.deadline) return;
        const days = Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000);
        if (days >= 0 && days <= 7 && (Number(g.current_amount) / Number(g.target_amount)) < 1) {
          ids.push(`goal-deadline-${g.id}`);
        }
      });
      const hasIncome = txs.some(t => t.type === "income");
      if (!hasIncome && new Date().getDate() > 5) ids.push(`no-income-${currentMonth}`);

      const allTasks = tasksRes.data;
      const overdueDates = [...new Set(allTasks.filter((t: any) => t.status === "pending" && t.date < today).map((t: any) => t.date))];
      overdueDates.slice(0, 5).forEach((d: any) => ids.push(`overdue-${d}`));
      const todayHigh = allTasks.filter((t: any) => t.date === today && t.status === "pending" && t.priority === "high");
      if (todayHigh.length > 0) ids.push(`today-high-${today}`);

      if (scheduleRes.data.length > 0) ids.push(`today-events-${today}`);

      count = ids.filter(id => !dismissed.includes(id)).length;
    } catch {}

    setNotifCount(count);
  };

  const goToDay = (date: string) => {
    setSelectedDate(date);
    setPage("tasks");
  };

  const goHome = () => {
    countNotifications();
    setPage("home");
  };

  const handleNotifNavigate = (app: string, extra?: any) => {
    countNotifications();
    if (app === "finance") {
      setFinanceSection(extra?.section);
      setPage("finance");
    } else if (app === "tasks") {
      if (extra?.date) setSelectedDate(extra.date);
      setPage("tasks");
    } else if (app === "week") {
      setPage("week");
    } else if (app === "journal") {
      setPage("journal");
    }
  };

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (page === "home") {
    return <GalaxyHome onNavigate={setPage} notifCount={notifCount} onLogout={handleLogout} />;
  }

  return (
    <div className="app-fullscreen" key={page}>
      <HomeButton onHome={goHome} />
      {page === "tasks" && <TasksPage selectedDate={selectedDate} onDateChange={setSelectedDate} />}
      {page === "calendar" && <CalendarPage onGoToDay={goToDay} />}
      {page === "documentation" && <DocumentationPage />}
      {page === "boards" && <BoardsPage />}
      {page === "week" && <WeekPage />}
      {page === "journal" && <JournalPage />}
      {page === "finance" && <FinancePage initialSection={financeSection} />}
      {page === "notifications" && <NotificationsPage onNavigate={handleNotifNavigate} />}
    </div>
  );
}
