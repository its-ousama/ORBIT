import { useState, useEffect } from "react";
import {
  getJournalStatus,
  setupJournal,
  verifyJournal,
  getJournals,
  createJournal,
  deleteJournal,
  renameJournal,
} from "../api";
import type { Journal } from "../types";
import JournalEditor from "./JournalEditor";
import "./css/JournalPage.css";

type GateState = "loading" | "setup" | "locked" | "unlocked";

export default function JournalPage() {
  const [gate, setGate] = useState<GateState>("loading");
  const [journals, setJournals] = useState<Journal[]>([]);
  const [openJournal, setOpenJournal] = useState<Journal | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState("");

  // Gate form state
  const [password, setPassword] = useState("");
  const [answer, setAnswer] = useState("");
  const [number, setNumber] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    getJournalStatus().then(({ configured }) => {
      setGate(configured ? "locked" : "setup");
    });
  }, []);

  const handleSetup = async () => {
    if (!password || !answer || !number) {
      setError("All fields are required.");
      return;
    }
    await setupJournal({ password, answer, number });
    setGate("unlocked");
    loadJournals();
  };

  const handleVerify = async () => {
    const res = await verifyJournal({ password, answer, number });
    if (res.success) {
      setGate("unlocked");
      loadJournals();
    } else {
      setError("Wrong credentials.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPassword(""); setAnswer(""); setNumber("");
    }
  };

  const loadJournals = async () => {
    const data = await getJournals();
    setJournals(data);
  };

  const handleCreate = async () => {
    const j = await createJournal("New Journal");
    setJournals(prev => [j, ...prev]);
    setOpenJournal(j);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this journal? This cannot be undone.")) return;
    await deleteJournal(id);
    setJournals(prev => prev.filter(j => j.id !== id));
    if (openJournal?.id === id) setOpenJournal(null);
  };

  const handleRename = async (id: number) => {
    if (!renameVal.trim()) return;
    const updated = await renameJournal(id, renameVal.trim());
    setJournals(prev => prev.map(j => j.id === id ? { ...j, name: updated.name } : j));
    setRenamingId(null);
  };

  // ── Gate screens ─────────────────────────────────────────────────────────

  if (gate === "loading") {
    return <div className="journal-gate"><p className="journal-gate-loading">...</p></div>;
  }

  if (gate === "setup") {
    return (
      <div className="journal-gate">
        <div className="journal-gate-box">
          <div className="journal-gate-icon">🔐</div>
          <h2>Set up your Journal</h2>
          <p className="journal-gate-sub">This is a one-time setup. Choose credentials only you know.</p>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="journal-gate-input"
          />
          <input
            type="password"
            placeholder="Your secret answer"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            className="journal-gate-input"
          />
          <input
            type="password"
            placeholder="Your number"
            value={number}
            onChange={e => setNumber(e.target.value)}
            className="journal-gate-input"
          />
          {error && <p className="journal-gate-error">{error}</p>}
          <button className="journal-gate-btn" onClick={handleSetup}>
            Create Journal Space
          </button>
        </div>
      </div>
    );
  }

  if (gate === "locked") {
    return (
      <div className="journal-gate">
        <div className={`journal-gate-box ${shake ? "shake" : ""}`}>
          <div className="journal-gate-icon">🔒</div>
          <h2>SETTINGS</h2>
          <p className="journal-gate-sub">Answer the question to enter.</p>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleVerify()}
            className="journal-gate-input"
          />
          <input
            type="password"
            placeholder="Is it God, BigBang or something else? "
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleVerify()}
            className="journal-gate-input"
          />
          <input
            type="password"
            placeholder="Gate number"
            value={number}
            onChange={e => setNumber(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleVerify()}
            className="journal-gate-input"
          />
          {error && <p className="journal-gate-error">{error}</p>}
          <button className="journal-gate-btn" onClick={handleVerify}>
            Enter
          </button>
        </div>
      </div>
    );
  }

  // ── Unlocked ─────────────────────────────────────────────────────────────

  if (openJournal) {
    return (
      <JournalEditor
        journal={openJournal}
        onBack={() => { setOpenJournal(null); loadJournals(); }}
        onThemeChange={(theme) => setOpenJournal(prev => prev ? { ...prev, theme } : prev)}
      />
    );
  }

  return (
    <div className="journal-list-page">
      <div className="journal-list-header">
        <h1>Journal</h1>
        <button className="journal-new-btn" onClick={handleCreate}>+ New Journal</button>
      </div>

      {journals.length === 0 ? (
        <div className="journal-empty">
          <p>No journals yet. Create your first one.</p>
        </div>
      ) : (
        <div className="journal-grid">
          {journals.map(j => (
            <div
              key={j.id}
              className="journal-card"
              style={{ background: j.theme?.bg || "#fff" }}
              onClick={() => setOpenJournal(j)}
            >
              <div className="journal-card-top">
                {renamingId === j.id ? (
                  <input
                    className="journal-rename-input"
                    value={renameVal}
                    autoFocus
                    onClick={e => e.stopPropagation()}
                    onChange={e => setRenameVal(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") handleRename(j.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => handleRename(j.id)}
                  />
                ) : (
                  <span className="journal-card-name">{j.name}</span>
                )}
                <div className="journal-card-actions" onClick={e => e.stopPropagation()}>
                  <button
                    title="Rename"
                    onClick={() => { setRenamingId(j.id); setRenameVal(j.name); }}
                  >✏️</button>
                  <button title="Delete" onClick={() => handleDelete(j.id)}>🗑</button>
                </div>
              </div>
              <p className="journal-card-date">
                {new Date(j.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}