import { useState } from "react";
import type { Page } from "../App";
import "./css/HomePage.css";

interface AppCard {
  page: Page;
  label: string;
  icon: string;
  color: string;
  gradient: string;
}

const apps: AppCard[] = [
  { page: "tasks",         label: "Tasks",         icon: "✓",  color: "#6366f1", gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)" },
  { page: "week",          label: "This Week",     icon: "▦",  color: "#3b82f6", gradient: "linear-gradient(135deg, #3b82f6, #06b6d4)" },
  { page: "calendar",      label: "Calendar",      icon: "◫",  color: "#10b981", gradient: "linear-gradient(135deg, #10b981, #059669)" },
  { page: "documentation", label: "Knowledge",     icon: "◈",  color: "#f59e0b", gradient: "linear-gradient(135deg, #f59e0b, #ef4444)" },
  { page: "boards",        label: "Boards",        icon: "⊞",  color: "#ec4899", gradient: "linear-gradient(135deg, #ec4899, #8b5cf6)" },
  { page: "journal",       label: "Settings",      icon: "⚙",  color: "#64748b", gradient: "linear-gradient(135deg, #475569, #334155)" },
  { page: "finance",       label: "Finance",       icon: "€",  color: "#10b981", gradient: "linear-gradient(135deg, #10b981, #3b82f6)" },
];

interface Props {
  onNavigate: (page: Page) => void;
}

export default function HomePage({ onNavigate }: Props) {
  const [hovering, setHovering] = useState<Page | null>(null);
  const [clicked, setClicked] = useState<Page | null>(null);

  const handleClick = (page: Page) => {
    setClicked(page);
    setTimeout(() => onNavigate(page), 300);
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="home-page">
      {/* Background particles */}
      <div className="home-bg">
        <div className="home-bg-orb home-bg-orb-1" />
        <div className="home-bg-orb home-bg-orb-2" />
        <div className="home-bg-orb home-bg-orb-3" />
      </div>

      {/* Clock */}
      <div className="home-clock">
        <div className="home-time">{timeStr}</div>
        <div className="home-date">{dateStr}</div>
      </div>

      {/* Logo */}
      <div className="home-logo">
        <div className="home-logo-badge">G+</div>
        <div className="home-logo-text">
          <span className="home-logo-main">GOOGLE PLUS</span>
          <span className="home-logo-sub">Your Personal OS</span>
        </div>
      </div>

      {/* App grid */}
      <div className="home-grid">
        {apps.map((app) => (
          <button
            key={app.page}
            className={`home-app-card ${clicked === app.page ? "clicked" : ""}`}
            onMouseEnter={() => setHovering(app.page)}
            onMouseLeave={() => setHovering(null)}
            onClick={() => handleClick(app.page)}
            style={{ "--app-color": app.color, "--app-gradient": app.gradient } as React.CSSProperties}
          >
            <div className="home-app-icon-wrap">
              <div className="home-app-icon">{app.icon}</div>
              {/* Shine effect */}
              <div className="home-app-shine" />
            </div>
            <span className="home-app-label">{app.label}</span>
          </button>
        ))}
      </div>

      {/* Bottom hint */}
      <div className="home-hint">Click any app to open</div>
    </div>
  );
}