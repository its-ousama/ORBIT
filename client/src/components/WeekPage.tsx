import { useState, useEffect } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import axios from "axios";
import "./css/WeekPage.css";

dayjs.extend(isoWeek);

const API = "http://localhost:3001/api/schedule";

type EventType = "work" | "shift" | "personal" | "meeting" | "gym";

interface ScheduleEvent {
  id: number;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  type: EventType;
}

const TYPE_COLORS: Record<EventType, { bg: string; border: string; text: string; dot: string }> = {
  work:     { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", dot: "#3b82f6" },
  shift:    { bg: "#fdf4ff", border: "#e9d5ff", text: "#7e22ce", dot: "#a855f7" },
  personal: { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d", dot: "#22c55e" },
  meeting:  { bg: "#fff7ed", border: "#fed7aa", text: "#c2410c", dot: "#f97316" },
  gym:  { bg: "#515050", border: "#afa091", text: "#fffb01", dot: "#d8f03d" },
};


const TYPE_LABELS: Record<EventType, string> = {
  work: "Work",
  shift: "Shift",
  personal: "Personal",
  meeting: "Meeting",
  gym: "Gym",
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface EventFormState {
  title: string;
  start_time: string;
  end_time: string;
  type: EventType;
  selectedDays: string[];
}

export default function WeekPage() {
  const [weekStart, setWeekStart] = useState(dayjs().isoWeekday(1).startOf("day"));
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormState>({
    title: "", start_time: "", end_time: "", type: "personal", selectedDays: [],
  });
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [jumpDate, setJumpDate] = useState("");

  const weekEnd = weekStart.add(6, "day");
  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day"));
  const today = dayjs().format("YYYY-MM-DD");

  useEffect(() => { loadEvents(); }, [weekStart]);

  const loadEvents = async () => {
    const res = await axios.get<ScheduleEvent[]>(API, {
      params: {
        start: weekStart.format("YYYY-MM-DD"),
        end: weekEnd.format("YYYY-MM-DD"),
      },
    });
    setEvents(res.data);
  };

  const eventsForDay = (date: string) =>
    events.filter(e => e.date === date).sort((a, b) => a.start_time.localeCompare(b.start_time));

  const openAddForm = (date: string) => {
    setEditingEvent(null);
    setForm({ title: "", start_time: "", end_time: "", type: "personal", selectedDays: [date] });
    setAddingTo(date);
  };

  const openEditForm = (event: ScheduleEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      start_time: event.start_time,
      end_time: event.end_time,
      type: event.type,
      selectedDays: [event.date],
    });
    setAddingTo(event.date);
  };

  const toggleDay = (date: string) => {
    setForm(f => ({
      ...f,
      selectedDays: f.selectedDays.includes(date)
        ? f.selectedDays.filter(d => d !== date)
        : [...f.selectedDays, date],
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;

    if (editingEvent) {
      const res = await axios.put<ScheduleEvent>(`${API}/${editingEvent.id}`, {
        title: form.title,
        date: editingEvent.date,
        start_time: form.start_time,
        end_time: form.end_time,
        type: form.type,
      });
      setEvents(prev => prev.map(e => e.id === editingEvent.id ? res.data : e));
    } else {
      if (form.selectedDays.length === 0) return;
      const res = await axios.post<ScheduleEvent[]>(`${API}/bulk`, {
        title: form.title,
        dates: form.selectedDays,
        start_time: form.start_time,
        end_time: form.end_time,
        type: form.type,
      });
      setEvents(prev => [...prev, ...res.data]);
    }

    setAddingTo(null);
    setEditingEvent(null);
    setForm({ title: "", start_time: "", end_time: "", type: "personal", selectedDays: [] });
  };

  const handleDelete = async (id: number) => {
    await axios.delete(`${API}/${id}`);
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const handleJump = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setJumpDate(val);
    if (val) {
      const d = dayjs(val);
      if (d.isValid()) setWeekStart(d.isoWeekday(1).startOf("day"));
    }
  };

  const isToday = (date: dayjs.Dayjs) => date.format("YYYY-MM-DD") === today;

  return (
    <div className="week-page">
      <div className="week-header">
        <div>
          <h2 className="week-title">This Week</h2>
          <p className="week-sub">{weekStart.format("MMM D")} — {weekEnd.format("MMM D, YYYY")}</p>
        </div>
        <div className="week-nav">
          <button className="week-nav-btn" onClick={() => setWeekStart(w => w.subtract(7, "day"))}>‹</button>
          <button className="week-today-btn" onClick={() => setWeekStart(dayjs().isoWeekday(1).startOf("day"))}>
            Today
          </button>
          <button className="week-nav-btn" onClick={() => setWeekStart(w => w.add(7, "day"))}>›</button>
          <input
            type="date"
            className="week-jump"
            value={jumpDate}
            onChange={handleJump}
            title="Jump to week"
          />
        </div>
      </div>

      <div className="week-legend">
        {(Object.entries(TYPE_COLORS) as [EventType, typeof TYPE_COLORS[EventType]][]).map(([type, c]) => (
          <span key={type} className="legend-item">
            <span className="legend-dot" style={{ background: c.dot }} />
            {TYPE_LABELS[type]}
          </span>
        ))}
      </div>

      <div className="week-grid">
        {days.map(day => {
          const key = day.format("YYYY-MM-DD");
          const dayEvents = eventsForDay(key);
          return (
            <div key={key} className={`week-col ${isToday(day) ? "today" : ""}`}>
              <div className="week-col-header">
                <span className="week-day-name">{day.format("ddd")}</span>
                <span className={`week-day-num ${isToday(day) ? "today-num" : ""}`}>
                  {day.format("D")}
                </span>
              </div>
              <div className="week-col-body">
                {dayEvents.map(ev => {
                  const c = TYPE_COLORS[ev.type];
                  return (
                    <div
                      key={ev.id}
                      className="week-event"
                      style={{ background: c.bg, borderColor: c.border }}
                    >
                      <div className="event-top">
                        <span className="event-dot" style={{ background: c.dot }} />
                        <span className="event-title" style={{ color: c.text }}>{ev.title}</span>
                      </div>
                      {(ev.start_time || ev.end_time) && (
                        <div className="event-time">
                          {ev.start_time}{ev.end_time ? ` → ${ev.end_time}` : ""}
                        </div>
                      )}
                      <div className="event-actions">
                        <button onClick={() => openEditForm(ev)}>✏️</button>
                        <button onClick={() => handleDelete(ev.id)}>🗑</button>
                      </div>
                    </div>
                  );
                })}
                <button className="week-add-btn" onClick={() => openAddForm(key)}>+</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {addingTo && (
        <div className="ef-overlay" onClick={() => { setAddingTo(null); setEditingEvent(null); }}>
          <div className="ef-modal" onClick={e => e.stopPropagation()}>
            <div className="ef-modal-header">
              <div>
                <div className="ef-modal-title">{editingEvent ? "Edit Event" : "Add Event"}</div>
                <div className="ef-modal-date">
                  {editingEvent
                    ? dayjs(editingEvent.date).format("dddd, MMM D")
                    : dayjs(addingTo).format("dddd, MMM D")}
                </div>
              </div>
              <button className="ef-modal-close" onClick={() => { setAddingTo(null); setEditingEvent(null); }}>✕</button>
            </div>

            <div className="ef-field">
              <label className="ef-label">Title</label>
              <input
                className="ef-input"
                placeholder="e.g. SNCF, Pub shift, Meeting with Alex..."
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleSave()}
                autoFocus
              />
            </div>

            <div className="ef-field">
              <label className="ef-label">Time</label>
              <div className="ef-row">
                <input
                  className="ef-time"
                  type="time"
                  value={form.start_time}
                  onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                />
                <span className="ef-arrow">→</span>
                <input
                  className="ef-time"
                  type="time"
                  value={form.end_time}
                  onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                />
              </div>
            </div>

            <div className="ef-field">
              <label className="ef-label">Type</label>
              <select
                className="ef-select"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as EventType }))}
              >
                {(Object.entries(TYPE_LABELS) as [EventType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {!editingEvent && (
              <div className="ef-field">
                <span className="ef-days-label">Repeat on</span>
                <div className="ef-days-grid">
                  {days.map((day, i) => {
                    const key = day.format("YYYY-MM-DD");
                    const selected = form.selectedDays.includes(key);
                    return (
                      <button
                        key={key}
                        className={`ef-day-btn ${selected ? "selected" : ""}`}
                        onClick={() => toggleDay(key)}
                        type="button"
                      >
                        {DAY_NAMES[i]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="ef-btns">
              <button className="ef-save" onClick={handleSave}>
                {editingEvent ? "Save Changes" : form.selectedDays.length > 1 ? `Add to ${form.selectedDays.length} days` : "Add Event"}
              </button>
              <button className="ef-cancel" onClick={() => { setAddingTo(null); setEditingEvent(null); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}