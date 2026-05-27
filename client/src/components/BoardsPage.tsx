import { useState, useEffect, useRef, useCallback } from "react";
import MobileGate from "./MobileGate";
import http from "../http";
import dayjs from "dayjs";
import "./css/BoardsPage.css";

const API = "/boards";

interface BoardMeta {
  id: number;
  name: string;
  updated_at: string;
}

interface BoardFull extends BoardMeta {
  data: any;
}

// Lazy load Excalidraw to keep initial bundle small
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export default function BoardsPage({ onGoHome }: { onGoHome?: () => void }) {
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [activeBoard, setActiveBoard] = useState<BoardFull | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadBoards(); }, []);

  const loadBoards = async () => {
    const res = await http.get<BoardMeta[]>(API);
    setBoards(res.data);
  };

  const openBoard = async (id: number) => {
    const res = await http.get<BoardFull>(`${API}/${id}`);
    setActiveBoard(res.data);
    setLastSaved(null);
  };

  const createBoard = async () => {
    if (!newName.trim()) return;
    const res = await http.post<BoardMeta>(API, { name: newName.trim() });
    setBoards(prev => [res.data, ...prev]);
    setNewName("");
    setCreating(false);
    openBoard(res.data.id);
  };

  const deleteBoard = async (id: number) => {
    if (!confirm("Delete this board?")) return;
    await http.delete(`${API}/${id}`);
    setBoards(prev => prev.filter(b => b.id !== id));
    if (activeBoard?.id === id) setActiveBoard(null);
  };

  const renameBoard = async () => {
    if (!activeBoard || !renameName.trim()) return;
    const res = await http.patch<BoardMeta>(`${API}/${activeBoard.id}`, { name: renameName.trim() });
    setBoards(prev => prev.map(b => b.id === res.data.id ? { ...b, name: res.data.name } : b));
    setActiveBoard(prev => prev ? { ...prev, name: res.data.name } : null);
    setRenaming(false);
  };

  // Debounced autosave — fires 2s after last change
  const handleChange = useCallback((elements: any, appState: any) => {
    if (!activeBoard) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await http.put(`${API}/${activeBoard.id}`, {
        data: { elements, appState: { ...appState, collaborators: [] } }
      });
      setLastSaved(dayjs().format("HH:mm:ss"));
    }, 2000);
  }, [activeBoard]);

  if (window.innerWidth <= 768) {
    return <MobileGate icon="🖥️" title="Open on desktop" message="Boards requires a larger screen." onBack={onGoHome} />;
  }

  if (activeBoard) {
    return (
      <div className="board-view">
        <div className="board-topbar">
          <button className="board-back" onClick={() => setActiveBoard(null)}>← Boards</button>
          {renaming ? (
            <div className="board-rename-row">
              <input
                className="board-rename-input"
                value={renameName}
                onChange={e => setRenameName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") renameBoard(); if (e.key === "Escape") setRenaming(false); }}
                autoFocus
              />
              <button className="board-rename-save" onClick={renameBoard}>Save</button>
              <button className="board-rename-cancel" onClick={() => setRenaming(false)}>Cancel</button>
            </div>
          ) : (
            <div className="board-name-row">
              <h2 className="board-active-name">{activeBoard.name}</h2>
              <button className="board-rename-btn" onClick={() => { setRenameName(activeBoard.name); setRenaming(true); }}>✏️</button>
            </div>
          )}
          <div className="board-save-status">
            {lastSaved ? `✓ Saved at ${lastSaved}` : "Changes save automatically"}
          </div>
        </div>
        <div className="board-canvas">
          <Excalidraw
            initialData={{
              elements: activeBoard.data?.elements || [],
              appState: activeBoard.data?.appState || {},
            }}
            onChange={handleChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="boards-page">
      <div className="mobile-block">
        <span>🖥️</span>
        <strong>Open on desktop</strong>
        <p>Boards requires a larger screen.</p>
      </div>
      <div className="boards-header">
        <div>
          <h2 className="boards-title">Boards</h2>
          <p className="boards-sub">Freeform canvases for notes, diagrams, and sketches</p>
        </div>
        <button className="boards-new-btn" onClick={() => setCreating(true)}>+ New Board</button>
      </div>

      {creating && (
        <div className="boards-create-row">
          <input
            className="boards-create-input"
            placeholder="Board name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") createBoard(); if (e.key === "Escape") setCreating(false); }}
            autoFocus
          />
          <button className="boards-create-confirm" onClick={createBoard}>Create</button>
          <button className="boards-create-cancel" onClick={() => setCreating(false)}>Cancel</button>
        </div>
      )}

      <div className="boards-grid">
        {boards.length === 0 && !creating && (
          <div className="boards-empty">
            <span>🎨</span>
            <p>No boards yet. Create one to start drawing.</p>
          </div>
        )}
        {boards.map(b => (
          <div key={b.id} className="board-card" onClick={() => openBoard(b.id)}>
            <div className="board-card-preview">🎨</div>
            <div className="board-card-info">
              <div className="board-card-name">{b.name}</div>
              <div className="board-card-date">Updated {dayjs(b.updated_at).format("MMM D, HH:mm")}</div>
            </div>
            <button
              className="board-card-delete"
              onClick={e => { e.stopPropagation(); deleteBoard(b.id); }}
              title="Delete"
            >🗑</button>
          </div>
        ))}
      </div>
    </div>
  );
}