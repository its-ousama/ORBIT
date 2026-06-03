import { useState } from "react";
import type { Page } from "../App";

import bankIcon from "../assets/icons8-investement-96.png";
import boardsIcon from "../assets/icons8-boards-96.png";
import bookIcon from "../assets/icons8-book-96.png";
import calendarIcon from "../assets/icons8-calendar-96.png";
import databaseIcon from "../assets/icons8-database-view-96.png";
import tasksIcon from "../assets/icons8-tasks-96.png";
import weekIcon from "../assets/icons8-week-view-96.png";

import "./css/HomePage.css";

interface AppCard {
  page: Page;
  label: string;
  icon: string;
  color: string;
  gradient: string;
}

const apps: AppCard[] = [
  { page: "tasks",         label: "Tasks",         icon: tasksIcon,    color: "#6366f1", gradient: "linear-gradient(135deg, #1e1b4b, #312e81)" },
  { page: "week",          label: "This Week",     icon: weekIcon,     color: "#3b82f6", gradient: "linear-gradient(135deg, #1e3a5f, #1e40af)" },
  { page: "calendar",      label: "Calendar",      icon: calendarIcon, color: "#10b981", gradient: "linear-gradient(135deg, #064e3b, #065f46)" },
  { page: "books",          label: "Books",         icon: bookIcon,     color: "#a78bfa", gradient: "linear-gradient(135deg, #2e1065, #4c1d95)" },
  { page: "boards",        label: "Boards",        icon: boardsIcon,   color: "#ec4899", gradient: "linear-gradient(135deg, #500724, #831843)" },
  { page: "journal",       label: "Journal",       icon: "📔",         color: "#64748b", gradient: "linear-gradient(135deg, #0f172a, #1e293b)" },
  { page: "finance",       label: "Finance",       icon: bankIcon,     color: "#10b981", gradient: "linear-gradient(135deg, #064e3b, #1e40af)" },
  { page: "notifications", label: "Notifications", icon: "🔔",         color: "#f97316", gradient: "linear-gradient(135deg, #f97316, #ef4444)" },
];

interface Props {
  onNavigate: (page: Page) => void;
  notifCount?: number;
  onLogout?: () => void;
  onToggleView?: () => void;
}

export default function HomePage({ onNavigate, notifCount = 0, onLogout, onToggleView }: Props) {
  const [clicked, setClicked] = useState<Page | null>(null);

  const handleClick = (page: Page) => {
    setClicked(page);
    setTimeout(() => onNavigate(page), 280);
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="home-page">
      <div className="home-bg">
        <div className="home-bg-orb home-bg-orb-1" />
        <div className="home-bg-orb home-bg-orb-2" />
        <div className="home-bg-orb home-bg-orb-3" />
      </div>

      <div className="home-clock">
        <div className="home-time">{timeStr}</div>
        <div className="home-date">{dateStr}</div>
      </div>

      <div className="home-logo">
        <div className="orbit-logo">
          <svg width="44" height="44" viewBox="0 0 42 42" fill="none">
            <circle cx="21" cy="21" r="19" stroke="url(#orbitGrad)" strokeWidth="2" strokeDasharray="4 2" opacity="0.5"/>
            <circle cx="21" cy="21" r="12" stroke="url(#orbitGrad)" strokeWidth="1.5"/>
            <circle cx="21" cy="21" r="4" fill="url(#orbitGrad)"/>
            <circle cx="21" cy="9" r="2.5" fill="#fff" opacity="0.9"/>
            <defs>
              <linearGradient id="orbitGrad" x1="0" y1="0" x2="42" y2="42" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6366f1"/>
                <stop offset="100%" stopColor="#06b6d4"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span className="home-logo-main">ORBIT</span>
      </div>

      <div className="home-grid">
        {apps.map((app) => (
          <button
            key={app.page}
            className={`home-app-card ${clicked === app.page ? "clicked" : ""}`}
            onClick={() => handleClick(app.page)}
            style={{ "--app-color": app.color, "--app-gradient": app.gradient } as React.CSSProperties}
          >
            <div className="home-app-icon-wrap">
              {typeof app.icon === "string" && app.icon.startsWith("data:") || app.icon.endsWith(".png") ? (
                <img
                  src={app.icon}
                  alt={app.label}
                  width="46"
                  height="46"
                  style={{ objectFit: "contain", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))" }}
                />
              ) : (
                <div className="home-app-icon">{app.icon}</div>
              )}
              <div className="home-app-shine" />
              {app.page === "notifications" && notifCount > 0 && (
                <div className="home-app-badge">{notifCount > 99 ? "99+" : notifCount}</div>
              )}
            </div>
            <span className="home-app-label">{app.label}</span>
          </button>
        ))}
      </div>

      <div className="home-hint">Everything revolves around you</div>

      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 100, display: "flex", gap: 8 }}>
        {onToggleView && (
          <button className="home-signout" onClick={onToggleView} title="Switch to galaxy view" style={{ position: "static" }}>
            ◎
          </button>
        )}
        {onLogout && (
          <button className="home-signout" onClick={onLogout} title="Sign out" style={{ position: "static" }}>
            ⏻
          </button>
        )}
      </div>
    </div>
  );
}