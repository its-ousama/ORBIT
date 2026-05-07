import { useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import type { Task, Priority, Status } from "../types";
import { getTasks, createTask, updateStatus, deleteTask } from "../api";
import TaskCard from "./TaskCard";
import "./css/TasksPage.css";

const PRIORITY_COLORS: Record<Priority, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

interface Props {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export default function TasksPage({ selectedDate, onDateChange }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [loading, setLoading] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const data = await getTasks(selectedDate);
    setTasks(data.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]));
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const task = await createTask({
      title: newTitle.trim(),
      date: selectedDate,
      priority: newPriority,
      color: PRIORITY_COLORS[newPriority],
    });
    setTasks(prev =>
      [...prev, task].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    );
    setNewTitle("");
  };

  const handleStatus = async (id: number, current: Status) => {
    const next: Status = current === "pending" ? "scratched" : "pending";
    const updated = await updateStatus(id, next);
    setTasks(prev =>
      prev.map(t => t.id === id ? updated : t)
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    );
  };

  const handleDelete = async (id: number) => {
    await deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleEdit = (updated: Task) => {
    setTasks(prev =>
      prev.map(t => t.id === updated.id ? updated : t)
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    );
  };

  const isToday = selectedDate === dayjs().format("YYYY-MM-DD");
  const isTomorrow = selectedDate === dayjs().add(1, "day").format("YYYY-MM-DD");
  const isYesterday = selectedDate === dayjs().subtract(1, "day").format("YYYY-MM-DD");

  const displayDate = isToday
    ? "Today"
    : isTomorrow
    ? "Tomorrow"
    : isYesterday
    ? "Yesterday"
    : dayjs(selectedDate).format("dddd");

  const pending = tasks.filter(t => t.status === "pending");
  const scratched = tasks.filter(t => t.status === "scratched");

  return (
    <div className="tasks-page">
      <div className="page-header">
        <div>
          <div className="date-nav">
            <button
              className="day-nav-btn"
              onClick={() => onDateChange(dayjs(selectedDate).subtract(1, "day").format("YYYY-MM-DD"))}
            >‹</button>
            <h2 className={`page-title ${isToday ? "is-today" : ""}`}>{displayDate}</h2>
            <button
              className="day-nav-btn"
              onClick={() => onDateChange(dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD"))}
            >›</button>
          </div>
          <p className="page-sub">{dayjs(selectedDate).format("MMMM D, YYYY")}</p>
        </div>
        <div className="page-stats">
          <span className="stat-pill">{pending.length} pending</span>
          {scratched.length > 0 && (
            <span className="stat-pill done">{scratched.length} scratched</span>
          )}
        </div>
      </div>

      {/* Add task */}
      <div className="add-task">
        <input
          className="task-input"
          placeholder="Add a task and press Enter..."
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
        />
        <select
          className="priority-select"
          value={newPriority}
          onChange={e => setNewPriority(e.target.value as Priority)}
        >
          <option value="high">🔴 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">🟢 Low</option>
        </select>
        <button className="add-btn" onClick={handleAdd}>+ Add</button>
      </div>

      {/* Task list */}
      <div className="task-list">
        {loading && <p className="empty">Loading...</p>}
        {!loading && tasks.length === 0 && (
          <p className="empty">No tasks for this day — add one above ☝️</p>
        )}
        {pending.map((task, i) => (
          <TaskCard
            key={task.id}
            task={task}
            index={i}
            onStatus={handleStatus}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        ))}
        {scratched.length > 0 && (
          <>
            <p className="section-label">Scratched</p>
            {scratched.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                index={i}
                onStatus={handleStatus}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}