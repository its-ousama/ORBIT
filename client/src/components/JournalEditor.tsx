import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import type { Journal, JournalTheme } from "../types";
import { saveJournalContent, updateJournalTheme, getJournal } from "../api";
import "./css/JournalEditor.css";

const FONTS = [
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Courier", value: "'Courier New', monospace" },
  { label: "Palatino", value: "Palatino, serif" },
];

const BACKGROUNDS = [
  { label: "White", value: "#ffffff" },
  { label: "Cream", value: "#fdf6e3" },
  { label: "Soft gray", value: "#f5f5f5" },
  { label: "Midnight", value: "#1a1a2e" },
  { label: "Forest", value: "#1b2e1b" },
  { label: "Navy", value: "#0f172a" },
];

interface Props {
  journal: Journal;
  onBack: () => void;
  onThemeChange: (theme: JournalTheme) => void;
}

export default function JournalEditor({ journal, onBack, onThemeChange }: Props) {
  const [theme, setTheme] = useState<JournalTheme>(journal.theme || { bg: "#ffffff", font: "Georgia, serif", textColor: "#1a1a1a" });
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [showTheme, setShowTheme] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDark = isDarkColor(theme.bg);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: "",
    editorProps: {
      attributes: {
        spellcheck: "true",
        autocorrect: "on",
      },
    },
    onUpdate: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveJournalContent(journal.id, editor.getJSON()).then(() => {
          setSavedAt(new Date().toLocaleTimeString());
        });
      }, 2000);
    },
  });

  // Load full content on mount
  useEffect(() => {
    getJournal(journal.id).then(full => {
      if (full.content && editor) {
        editor.commands.setContent(full.content);
      }
    });
  }, [journal.id]);

  const applyTheme = useCallback(async (newTheme: JournalTheme) => {
    setTheme(newTheme);
    onThemeChange(newTheme);
    await updateJournalTheme(journal.id, newTheme);
  }, [journal.id]);

  const toolbar = editor && (
    <div className="journal-toolbar">
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive("bold") ? "active" : ""} title="Bold"><b>B</b></button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive("italic") ? "active" : ""} title="Italic"><i>I</i></button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive("underline") ? "active" : ""} title="Underline"><u>U</u></button>
      <div className="journal-toolbar-sep" />
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive("heading", { level: 1 }) ? "active" : ""}>H1</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive("heading", { level: 2 }) ? "active" : ""}>H2</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive("heading", { level: 3 }) ? "active" : ""}>H3</button>
      <div className="journal-toolbar-sep" />
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive("bulletList") ? "active" : ""}>• List</button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive("orderedList") ? "active" : ""}>1. List</button>
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive("blockquote") ? "active" : ""}>" Quote</button>
      <div className="journal-toolbar-sep" />
      <button onClick={() => editor.chain().focus().setTextAlign("left").run()} className={editor.isActive({ textAlign: "left" }) ? "active" : ""}>⬅</button>
      <button onClick={() => editor.chain().focus().setTextAlign("center").run()} className={editor.isActive({ textAlign: "center" }) ? "active" : ""}>≡</button>
      <button onClick={() => editor.chain().focus().setTextAlign("right").run()} className={editor.isActive({ textAlign: "right" }) ? "active" : ""}>➡</button>
    </div>
  );

  return (
    <div className="journal-editor-page" style={{ background: theme.bg, color: theme.textColor, fontFamily: theme.font }}>

      {/* Top bar */}
      <div className="journal-editor-topbar" style={{ borderBottomColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}>
        <button className="journal-back-btn" style={{ color: isDark ? "#aaa" : "#555" }} onClick={onBack}>
          ← Back
        </button>
        <span className="journal-editor-title" style={{ color: isDark ? "#eee" : "#1a1a1a" }}>
          {journal.name}
        </span>
        <div className="journal-topbar-right">
          {savedAt && (
            <span className="journal-saved" style={{ color: isDark ? "#6ee7b7" : "#16a34a" }}>
              ✓ Saved at {savedAt}
            </span>
          )}
          <button
            className="journal-theme-toggle"
            style={{ color: isDark ? "#ccc" : "#555" }}
            onClick={() => setShowTheme(v => !v)}
            title="Customize"
          >
            🎨
          </button>
        </div>
      </div>

      {/* Theme panel */}
      {showTheme && (
        <div className="journal-theme-panel" style={{ background: isDark ? "#1e1e2e" : "#f9f9f9", borderColor: isDark ? "#333" : "#e5e7eb", color: isDark ? "#ddd" : "#333" }}>
          <div className="journal-theme-section">
            <label>Background</label>
            <div className="journal-theme-swatches">
              {BACKGROUNDS.map(b => (
                <button
                  key={b.value}
                  title={b.label}
                  className={`journal-swatch ${theme.bg === b.value ? "selected" : ""}`}
                  style={{ background: b.value, border: theme.bg === b.value ? "2px solid #6366f1" : "2px solid transparent" }}
                  onClick={() => applyTheme({ ...theme, bg: b.value, textColor: isDarkColor(b.value) ? "#e5e7eb" : "#1a1a1a" })}
                />
              ))}
              <input
                type="color"
                value={theme.bg}
                title="Custom color"
                onChange={e => applyTheme({ ...theme, bg: e.target.value, textColor: isDarkColor(e.target.value) ? "#e5e7eb" : "#1a1a1a" })}
                className="journal-color-picker"
              />
            </div>
          </div>
          <div className="journal-theme-section">
            <label>Font</label>
            <div className="journal-font-options">
              {FONTS.map(f => (
                <button
                  key={f.value}
                  className={`journal-font-btn ${theme.font === f.value ? "selected" : ""}`}
                  style={{ fontFamily: f.value }}
                  onClick={() => applyTheme({ ...theme, font: f.value })}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ borderBottomColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
        {toolbar}
      </div>

      {/* Editor */}
      <div className="journal-editor-body">
        <EditorContent
          editor={editor}
          className="journal-tiptap"
          style={{ fontFamily: theme.font, color: theme.textColor }}
        />
      </div>
    </div>
  );
}

function isDarkColor(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}