import { useState, useRef, useEffect } from "react";
import type { Task, Priority, Status } from "../types";
import axios from "axios";
import "./css/TaskCard.css";

const PRIORITY_COLORS: Record<Priority, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

const PRIORITY_BG: Record<Priority, string> = {
  high: "#fef2f2",
  medium: "#fffbeb",
  low: "#f0fdf4",
};

const PRIORITY_TEXT: Record<Priority, string> = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#16a34a",
};

interface Props {
  task: Task;
  index?: number;
  onStatus: (id: number, current: Status) => void;
  onDelete: (id: number) => void;
  onEdit: (updated: Task) => void;
}

export default function TaskCard({ task, index = 0, onStatus, onDelete, onEdit }: Props) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editPriority, setEditPriority] = useState<Priority>(task.priority);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const saveEdit = async () => {
    if (!editTitle.trim()) return;
    const res = await axios.patch<Task>(`http://localhost:3001/api/tasks/${task.id}`, {
      title: editTitle.trim(),
      priority: editPriority,
      color: PRIORITY_COLORS[editPriority],
    });
    onEdit(res.data);
    setEditing(false);
  };

  const color = PRIORITY_COLORS[task.priority];

  if (editing) {
    return (
      <div
        className="task-card editing"
        style={{ "--priority-color": PRIORITY_COLORS[editPriority], "--index": index } as React.CSSProperties}
      >
        <input
          ref={inputRef}
          className="edit-input"
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <select
          className="edit-priority"
          value={editPriority}
          onChange={e => setEditPriority(e.target.value as Priority)}
        >
          <option value="high">🔴 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">🟢 Low</option>
        </select>
        <button className="save-btn" onClick={saveEdit}>Save</button>
        <button className="cancel-btn" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <div
      className={`task-card ${task.status === "scratched" ? "scratched" : ""}`}
      style={{ "--priority-color": color, "--index": index } as React.CSSProperties}
    >
      {/* Scratch button */}
      <button
        className="scratch-btn"
        onClick={() => onStatus(task.id, task.status)}
        title={task.status === "pending" ? "Mark done" : "Undo"}
      >
        {task.status === "scratched" ? (
          <span className="scratch-check">✓</span>
        ) : (
          <span className="scratch-btn-inner" />
        )}
      </button>

      {/* Content */}
      <div className="task-body">
        <span className={`task-title ${task.status === "scratched" ? "crossed" : ""}`}>
          {task.title}
        </span>
        <span
          className="priority-badge"
          style={{
            background: PRIORITY_BG[task.priority],
            color: PRIORITY_TEXT[task.priority],
            borderColor: color + "33",
          }}
        >
          {task.priority}
        </span>
      </div>

      {/* Actions */}
      <div className="task-actions">
        <button className="action-btn" onClick={() => setEditing(true)} title="Edit">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="action-btn delete" onClick={() => onDelete(task.id)} title="Delete">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 3.5h10M5 3.5V2h4v1.5M5.5 6v4M8.5 6v4M3 3.5l.7 8h6.6l.7-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}