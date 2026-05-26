import { useState, useEffect } from "react";
import type { Topic } from "../types";
import { getTopics, deleteTopic } from "../api";
import TopicView from "./TopicView";
import TopicForm from "./TopicForm";
import "./css/DocumentationPage.css";

export default function DocumentationPage({ onGoHome }: { onGoHome?: () => void }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selected, setSelected] = useState<Topic | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);

  useEffect(() => { loadTopics(); }, []);

  const loadTopics = async () => {
    const data = await getTopics();
    setTopics(data);
    if (data.length > 0 && !selected) setSelected(data[0]);
  };

  const grouped = topics
    .filter(t =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase())
    )
    .reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = [];
      acc[t.category].push(t);
      return acc;
    }, {} as Record<string, Topic[]>);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this topic?")) return;
    await deleteTopic(id);
    const updated = topics.filter(t => t.id !== id);
    setTopics(updated);
    if (selected?.id === id) setSelected(updated[0] || null);
  };

  const handleSaved = (topic: Topic) => {
    setTopics(prev => {
      const exists = prev.find(t => t.id === topic.id);
      return exists
        ? prev.map(t => t.id === topic.id ? topic : t)
        : [...prev, topic];
    });
    setSelected(topic);
    setShowForm(false);
    setEditingTopic(null);
  };

  if (showForm || editingTopic) {
    return (
      <TopicForm
        topic={editingTopic}
        existingTopics={topics}
        onSaved={handleSaved}
        onCancel={() => { setShowForm(false); setEditingTopic(null); }}
      />
    );
  }

  return (
    <div className="doc-layout">
      <div className="mobile-block">
        <span>🖥️</span>
        <strong>Open on desktop</strong>
        <p>The knowledge base requires a larger screen.</p>
        {onGoHome && (
          <button onClick={onGoHome} style={{ marginTop: "1rem", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "8px", color: "#fff", fontSize: "0.875rem", padding: "0.5rem 1.25rem", cursor: "pointer" }}>
            ← Home
          </button>
        )}
      </div>
      <aside className="doc-sidebar">
        <div className="doc-sidebar-top">
          <h3 className="doc-sidebar-title">Knowledge Base</h3>
          <p className="doc-sidebar-sub">{topics.length} topic{topics.length !== 1 ? "s" : ""}</p>
        </div>

        <div className="doc-search-wrap">
          <input
            className="doc-search"
            placeholder="Search topics..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="doc-nav">
          {Object.entries(grouped).map(([cat, catTopics]) => (
            <div key={cat} className="doc-cat-group">
              <div className="doc-cat-label">
                <span>{cat}</span>
                <span className="doc-cat-count">{catTopics.length}</span>
              </div>
              {catTopics.map(t => (
                <div
                  key={t.id}
                  className={`doc-nav-item ${selected?.id === t.id ? "active" : ""}`}
                  style={{ "--topic-color": t.color } as React.CSSProperties}
                  onClick={() => setSelected(t)}
                >
                  <span className="doc-nav-icon">{t.icon}</span>
                  <span className="doc-nav-name">{t.name}</span>
                </div>
              ))}
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <p className="doc-empty-search">No topics found.</p>
          )}
        </div>

        <button className="doc-add-btn" onClick={() => setShowForm(true)}>
          + New Topic
        </button>
      </aside>

      <div className="doc-main">
        {selected ? (
          <TopicView
            topic={selected}
            allTopics={topics}
            onNavigate={setSelected}
            onEdit={() => setEditingTopic(selected)}
            onDelete={() => handleDelete(selected.id)}
          />
        ) : (
          <div className="doc-welcome">
            <span className="doc-welcome-icon">📚</span>
            <h3>Select a topic to read</h3>
            <p>Or create a new one using the button below.</p>
          </div>
        )}
      </div>
    </div>
  );
}