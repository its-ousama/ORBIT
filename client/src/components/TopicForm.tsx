import { useState } from "react";
import type { Topic, Concept } from "../types";
import { createTopic, updateTopic } from "../api";
import "./css/TopicForm.css";

const COLORS = ["#2563eb","#dc2626","#059669","#7c3aed","#d97706","#0891b2","#db2777","#ea580c"];
const DEFAULT_CATEGORIES = ["Monitoring Stack", "Data & Messaging", "Infrastructure", "DevOps"];

interface Props {
  topic: Topic | null;
  existingTopics: Topic[];
  onSaved: (t: Topic) => void;
  onCancel: () => void;
}

export default function TopicForm({ topic, existingTopics, onSaved, onCancel }: Props) {
  const [name, setName] = useState(topic?.name || "");
  const [abbr, setAbbr] = useState(topic?.abbr || "");
  const [icon, setIcon] = useState(topic?.icon || "📄");
  const [color, setColor] = useState(topic?.color || "#2563eb");
  const [category, setCategory] = useState(topic?.category || DEFAULT_CATEGORIES[0]);
  const [customCat, setCustomCat] = useState("");
  const [description, setDescription] = useState(topic?.description || "");
  const [analogy, setAnalogy] = useState(topic?.analogy || "");
  const [concepts, setConcepts] = useState<Concept[]>(topic?.concepts?.length ? topic.concepts : [{ term: "", def: "" }]);
  const [saving, setSaving] = useState(false);

  const finalCategory = category === "__custom__" ? customCat : category;

  const updateConcept = (i: number, field: keyof Concept, val: string) => {
    setConcepts(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  };

  const handleSave = async () => {
    if (!name.trim() || !finalCategory.trim()) return;
    setSaving(true);
    const slug = topic?.slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const payload = {
      slug, name, abbr, icon, color,
      category: finalCategory,
      description, analogy,
      concepts: concepts.filter(c => c.term.trim()),
      connects: topic?.connects || [],
    };
    const saved = topic ? await updateTopic(topic.id, payload) : await createTopic(payload);
    onSaved(saved);
    setSaving(false);
  };

  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...existingTopics.map(t => t.category)]));

  return (
    <div className="topic-form">
      <div className="tf-header">
        <h2>{topic ? "Edit Topic" : "New Topic"}</h2>
        <button className="tf-cancel" onClick={onCancel}>✕ Cancel</button>
      </div>

      <div className="tf-body">
        {/* Basic info */}
        <div className="tf-section">
          <div className="tf-section-header">Basic Info</div>
          <div className="tf-section-body">
            <div className="tf-row">
              <div className="tf-field">
                <label>Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Grafana" />
              </div>
              <div className="tf-field tf-field-sm">
                <label>Icon</label>
                <input value={icon} onChange={e => setIcon(e.target.value)} placeholder="📄" />
              </div>
            </div>
            <div className="tf-field">
              <label>Short description</label>
              <input value={abbr} onChange={e => setAbbr(e.target.value)} placeholder="e.g. Data Visualization Platform" />
            </div>
          </div>
        </div>

        {/* Category & color */}
        <div className="tf-section">
          <div className="tf-section-header">Category & Appearance</div>
          <div className="tf-section-body">
            <div className="tf-row">
              <div className="tf-field">
                <label>Category *</label>
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__custom__">+ New category...</option>
                </select>
                {category === "__custom__" && (
                  <input
                    className="tf-custom-cat"
                    value={customCat}
                    onChange={e => setCustomCat(e.target.value)}
                    placeholder="Category name"
                  />
                )}
              </div>
              <div className="tf-field tf-field-md">
                <label>Color</label>
                <div className="tf-colors">
                  {COLORS.map(c => (
                    <div
                      key={c}
                      className={`tf-color-dot ${color === c ? "selected" : ""}`}
                      style={{ background: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="tf-section">
          <div className="tf-section-header">Content</div>
          <div className="tf-section-body">
            <div className="tf-field">
              <label>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                placeholder="What is this? How is it used?"
              />
            </div>
            <div className="tf-field">
              <label>Analogy <span className="tf-optional">(optional)</span></label>
              <textarea
                value={analogy}
                onChange={e => setAnalogy(e.target.value)}
                rows={2}
                placeholder="A simple analogy to remember this..."
              />
            </div>
          </div>
        </div>

        {/* Key concepts */}
        <div className="tf-section">
          <div className="tf-section-header">Key Concepts</div>
          <div className="tf-section-body">
            <div className="tf-concepts-list">
              {concepts.map((c, i) => (
                <div key={i} className="tf-concept-row">
                  <input
                    placeholder="Term"
                    value={c.term}
                    onChange={e => updateConcept(i, "term", e.target.value)}
                    className="tf-concept-term"
                  />
                  <input
                    placeholder="Definition"
                    value={c.def}
                    onChange={e => updateConcept(i, "def", e.target.value)}
                    className="tf-concept-def"
                  />
                  <button
                    className="tf-remove-concept"
                    onClick={() => setConcepts(prev => prev.filter((_, idx) => idx !== i))}
                  >✕</button>
                </div>
              ))}
              <button
                className="tf-add-concept"
                onClick={() => setConcepts(prev => [...prev, { term: "", def: "" }])}
              >
                + Add concept
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="tf-footer">
        <button className="tf-save" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : topic ? "Save Changes" : "Create Topic"}
        </button>
        <button className="tf-cancel-footer" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}