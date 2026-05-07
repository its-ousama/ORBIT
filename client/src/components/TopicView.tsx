import type { Topic } from "../types";
import "./css/TopicView.css";

const ACCENT: Record<string, { bg: string; border: string }> = {
  "#2563eb": { bg: "#eff6ff", border: "#bfdbfe" },
  "#dc2626": { bg: "#fef2f2", border: "#fecaca" },
  "#059669": { bg: "#ecfdf5", border: "#a7f3d0" },
  "#7c3aed": { bg: "#f5f3ff", border: "#ddd6fe" },
  "#d97706": { bg: "#fffbeb", border: "#fde68a" },
  "#0891b2": { bg: "#ecfeff", border: "#a5f3fc" },
  "#db2777": { bg: "#fdf2f8", border: "#f9a8d4" },
  "#ea580c": { bg: "#fff7ed", border: "#fed7aa" },
};

const acc = (color: string) => ACCENT[color] || { bg: "#f8fafc", border: "#e2e8f0" };

interface Props {
  topic: Topic;
  allTopics: Topic[];
  onNavigate: (t: Topic) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function TopicView({ topic, allTopics, onNavigate, onEdit, onDelete }: Props) {
  const { bg, border } = acc(topic.color);

  return (
    <div
      className="topic-view"
      style={{ "--topic-color": topic.color, "--topic-bg": bg } as React.CSSProperties}
    >
      {/* Hero */}
      <div className="tv-hero" style={{ "--topic-bg": bg } as React.CSSProperties}>
        <div className="tv-icon" style={{ background: bg, borderColor: border }}>
          {topic.icon}
        </div>
        <div className="tv-hero-text">
          <h1 className="tv-name" style={{ color: topic.color }}>{topic.name}</h1>
          {topic.abbr && <p className="tv-abbr">{topic.abbr}</p>}
          <span
            className="tv-cat-tag"
            style={{ background: bg, color: topic.color, border: `1px solid ${border}` }}
          >
            {topic.category}
          </span>
        </div>
        <div className="tv-actions">
          <button className="tv-btn" onClick={onEdit}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M8 2l3 3L4.5 11H1.5v-3L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Edit
          </button>
          <button className="tv-btn delete" onClick={onDelete}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1.5 3h10M4.5 3V1.5h4V3M5 5.5v4M8 5.5v4M2.5 3l.7 8h6.6l.7-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Delete
          </button>
        </div>
      </div>

      {/* Body sections */}
      <div className="tv-body">
        {/* Description */}
        {topic.description && (
          <div className="tv-section">
            <div className="tv-section-header">
              <span className="tv-section-icon">📝</span>
              <span className="tv-section-title">Overview</span>
            </div>
            <div className="tv-section-body">
              <p className="tv-description">{topic.description}</p>
            </div>
          </div>
        )}

        {/* Analogy */}
        {topic.analogy && (
          <div className="tv-section">
            <div className="tv-section-header">
              <span className="tv-section-icon">💡</span>
              <span className="tv-section-title">Analogy</span>
            </div>
            <div className="tv-section-body">
              <p
                className="tv-analogy"
                style={{ borderColor: topic.color }}
              >
                {topic.analogy}
              </p>
            </div>
          </div>
        )}

        {/* Key Concepts */}
        {topic.concepts.length > 0 && (
          <div className="tv-section">
            <div className="tv-section-header">
              <span className="tv-section-icon">🔑</span>
              <span className="tv-section-title">Key Concepts</span>
            </div>
            <div className="tv-section-body">
              <div className="tv-concepts">
                {topic.concepts.map((c, i) => (
                  <div key={i} className="tv-concept-card">
                    <div className="tv-concept-term">{c.term}</div>
                    <div className="tv-concept-def">{c.def}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Connects to */}
        {topic.connects.length > 0 && (
          <div className="tv-section">
            <div className="tv-section-header">
              <span className="tv-section-icon">🔗</span>
              <span className="tv-section-title">Connects to</span>
            </div>
            <div className="tv-section-body">
              <div className="tv-connects">
                {topic.connects.map((c, i) => {
                  const linked = allTopics.find(t => t.slug === c.id);
                  if (!linked) return null;
                  return (
                    <div
                      key={i}
                      className="tv-connect-chip"
                      onClick={() => onNavigate(linked)}
                    >
                      <span
                        className="tv-connect-dot"
                        style={{ background: linked.color, color: linked.color }}
                      />
                      <div>
                        <div className="tv-connect-name">{linked.icon} {linked.name}</div>
                        <div className="tv-connect-why">{c.why}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}