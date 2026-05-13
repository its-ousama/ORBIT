import { useState, useEffect } from "react";
import dayjs from "dayjs";
import http from "../http";
import type { Task, Priority } from "../types";
import "./css/CalendarPage.css";

const PRIORITY_COLOR: Record<Priority, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

interface Props {
  onGoToDay: (date: string) => void;
}

interface DayPopup {
  date: string;
  tasks: Task[];
}

export default function CalendarPage({ onGoToDay }: Props) {
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf("month"));
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [popup, setPopup] = useState<DayPopup | null>(null);

  useEffect(() => {
    http.get<Task[]>("/tasks").then(r => setAllTasks(r.data));
  }, []);

  const tasksByDate: Record<string, Task[]> = {};
  allTasks.forEach(t => {
  const key = t.date.slice(0, 10);
  if (!tasksByDate[key]) tasksByDate[key] = [];
  tasksByDate[key].push(t);
  });

  const startOfGrid = currentMonth.startOf("week");
  const endOfGrid = currentMonth.endOf("month").endOf("week");
  const days: dayjs.Dayjs[] = [];
  let cursor = startOfGrid;
  while (cursor.isBefore(endOfGrid) || cursor.isSame(endOfGrid, "day")) {
    days.push(cursor);
    cursor = cursor.add(1, "day");
  }

  const today = dayjs().format("YYYY-MM-DD");

  const openPopup = (date: string) => {
    setPopup({ date, tasks: tasksByDate[date] || [] });
  };

  return (
    <div className="calendar-page">
      <div className="cal-header">
        <h2 className="cal-title">Calendar</h2>
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={() => setCurrentMonth(m => m.subtract(1, "month"))}>‹</button>
          <span className="cal-month-label">{currentMonth.format("MMMM YYYY")}</span>
          <button className="cal-nav-btn" onClick={() => setCurrentMonth(m => m.add(1, "month"))}>›</button>
        </div>
      </div>

      <div className="cal-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="cal-weekday">{d}</div>
        ))}

        {days.map(day => {
          const key = day.format("YYYY-MM-DD");
          const tasks = tasksByDate[key] || [];
          const isCurrentMonth = day.month() === currentMonth.month();
          const isToday = key === today;

          const sorted = [...tasks].sort((a, b) => {
            const order = { high: 0, medium: 1, low: 2 };
            return order[a.priority] - order[b.priority];
          });

          return (
            <div
              key={key}
              className={`cal-day ${!isCurrentMonth ? "faded" : ""} ${isToday ? "today" : ""}`}
              onClick={() => openPopup(key)}
            >
              <span className="cal-day-num">{day.date()}</span>
              {sorted.length > 0 && (
                <div className="cal-dots">
                  {sorted.slice(0, 4).map((t, i) => (
                    <span key={i} className="cal-dot" style={{ background: PRIORITY_COLOR[t.priority] }} />
                  ))}
                  {sorted.length > 4 && <span className="cal-dot-extra">+{sorted.length - 4}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {popup && (
        <div className="popup-overlay" onClick={() => setPopup(null)}>
          <div className="popup" onClick={e => e.stopPropagation()}>
            <div className="popup-header">
              <div>
                <p className="popup-weekday">{dayjs(popup.date).format("dddd")}</p>
                <h3 className="popup-date">{dayjs(popup.date).format("MMMM D, YYYY")}</h3>
              </div>
              <button className="popup-close" onClick={() => setPopup(null)}>✕</button>
            </div>

            <div className="popup-tasks">
              {popup.tasks.length === 0 && (
                <p className="popup-empty">No tasks for this day.</p>
              )}
              {[...popup.tasks]
                .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]))
                .map(task => (
                  <div
                    key={task.id}
                    className={`popup-task ${task.status === "scratched" ? "scratched" : ""}`}
                    style={{ borderLeft: `3px solid ${PRIORITY_COLOR[task.priority]}` }}
                  >
                    <span className="popup-task-title">{task.title}</span>
                    <span className="popup-task-priority" style={{ color: PRIORITY_COLOR[task.priority] }}>
                      {task.priority}
                    </span>
                  </div>
                ))}
            </div>

            <button className="popup-goto" onClick={() => { onGoToDay(popup.date); setPopup(null); }}>
              Go to this day →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}