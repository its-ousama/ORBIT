import { useEffect, useRef, useState } from "react";
import http from "../../http";
import { updateProgress } from "../../booksAPI";
import "./EpubReader.css";

interface Props {
  bookId: number;
  initialLocation?: string;
  onProgress: (location: string, percent: number) => void;
  onClose: () => void;
}

type FontSize = "small" | "medium" | "large";

const FONT_SIZES: Record<FontSize, string> = {
  small: "85%",
  medium: "110%",
  large: "140%",
};

export default function EpubReader({ bookId, initialLocation, onProgress, onClose }: Props) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<any>(null);
  const renditionRef = useRef<any>(null);

  const [fontSize, setFontSize] = useState<FontSize>(
    () => (localStorage.getItem("epub_font_size") as FontSize) || "medium"
  );
  const [darkMode, setDarkMode] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [toc, setToc] = useState<Array<{ label: string; href: string }>>([]);
  const [percent, setPercent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let destroyed = false;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let lastProgress: { cfi: string; pct: number } | null = null;

    const load = async () => {
      try {
        const res = await http.get(`/books/${bookId}/file`, { responseType: "arraybuffer" });
        if (destroyed) return;

        // Dynamic import so epubjs (browser-only) doesn't affect SSR / Vite chunking at module parse time
        const Epub = (await import("epubjs")).default;
        const book = Epub(res.data as ArrayBuffer);
        bookRef.current = book;

        await book.ready;
        if (destroyed) return;

        const rendition = book.renderTo(viewerRef.current!, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          spread: "none",
        });
        renditionRef.current = rendition;

        rendition.themes.register("light", {
          body: {
            background: "#f8f7f2 !important",
            color: "#1a1a1a !important",
            "font-family": "Georgia, 'Times New Roman', serif !important",
            "line-height": "1.7 !important",
          },
        });
        rendition.themes.register("dark", {
          body: {
            background: "#111827 !important",
            color: "#d1d5db !important",
            "font-family": "Georgia, 'Times New Roman', serif !important",
            "line-height": "1.7 !important",
          },
          "a, a:visited": { color: "#818cf8 !important" },
        });
        rendition.themes.select("light");
        // Use saved font size so preference is applied immediately on load
        rendition.themes.fontSize(FONT_SIZES[fontSize]);

        // Guard: don't save progress during initial display — epubjs snaps CFI to page
        // start which differs slightly from the stored CFI, causing drift each session.
        // Also debounce saves so rapid page turns don't send out-of-order HTTP requests.
        let initialDisplayDone = false;

        rendition.on("relocated", (location: any) => {
          const cfi = location?.start?.cfi ?? "";
          // percentageFromCfi is accurate once locations are generated; fall back to epubjs value
          const raw = book.locations?.percentageFromCfi
            ? (book.locations.percentageFromCfi(cfi) ?? location?.start?.percentage ?? 0)
            : (location?.start?.percentage ?? 0);
          const pct = Math.min(100, Math.floor(raw * 100));
          setPercent(pct);
          // Don't call onProgress during initial display — epubjs returns 0 before locations
          // are generated, which would overwrite the real server-stored percentage in the card
          if (initialDisplayDone) {
            onProgress(cfi, pct);
            if (cfi) {
              lastProgress = { cfi, pct };
              if (saveTimer) clearTimeout(saveTimer);
              saveTimer = setTimeout(() => {
                if (!destroyed) updateProgress(bookId, cfi, pct).catch(() => {});
              }, 800);
            }
          }
        });

        if (initialLocation) {
          await rendition.display(initialLocation);
        } else {
          await rendition.display();
        }
        initialDisplayDone = true;

        // Generate locations in background so percentage works on page turns
        // 1024 = chars per "location" — standard epubjs default
        book.locations.generate(1024).catch(() => {});

        const nav = await book.loaded.navigation;
        setToc((nav?.toc ?? []).map((item: any) => ({ label: item.label?.trim() ?? "", href: item.href })));
        setLoading(false);
      } catch {
        if (!destroyed) {
          setError("Failed to load book. The file may be corrupted or unsupported.");
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      destroyed = true;
      // Flush any pending debounced save immediately so the last position isn't lost on close
      if (saveTimer) {
        clearTimeout(saveTimer);
        if (lastProgress) updateProgress(bookId, lastProgress.cfi, lastProgress.pct).catch(() => {});
      }
      if (bookRef.current) {
        try { bookRef.current.destroy(); } catch { /* ignore */ }
        bookRef.current = null;
      }
    };
  }, [bookId]);

  // Apply theme / font size changes after load
  useEffect(() => {
    renditionRef.current?.themes.select(darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    renditionRef.current?.themes.fontSize(FONT_SIZES[fontSize]);
  }, [fontSize]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") renditionRef.current?.next();
      else if (e.key === "ArrowLeft" || e.key === "PageUp") renditionRef.current?.prev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const goToChapter = (href: string) => {
    renditionRef.current?.display(href);
    setShowToc(false);
  };

  return (
    <div className={`epub-reader ${darkMode ? "epub-dark" : "epub-light"}`}>
      {/* Top bar */}
      <div className="epub-topbar">
        <button className="epub-topbar-btn" onClick={onClose}>← Back</button>

        <div className="epub-topbar-controls">
          <button className="epub-topbar-btn" onClick={() => setShowToc(t => !t)}>
            ☰ Chapters
          </button>
          <div className="epub-font-group">
            {(["small", "medium", "large"] as FontSize[]).map(s => (
              <button
                key={s}
                className={`epub-font-btn ${fontSize === s ? "active" : ""}`}
                onClick={() => { setFontSize(s); localStorage.setItem("epub_font_size", s); }}
                title={`Font: ${s}`}
                style={{ fontSize: s === "small" ? "11px" : s === "medium" ? "14px" : "18px" }}
              >
                A
              </button>
            ))}
          </div>
          <button
            className="epub-topbar-btn"
            onClick={() => setDarkMode(d => !d)}
            title="Toggle theme"
          >
            {darkMode ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>
      </div>

      {/* TOC sidebar */}
      {showToc && (
        <div className="epub-toc">
          <div className="epub-toc-title">Chapters</div>
          <div className="epub-toc-scroll">
            {toc.length === 0 && <p className="epub-toc-empty">No chapters found</p>}
            {toc.map((item, i) => (
              <button key={i} className="epub-toc-item" onClick={() => goToChapter(item.href)}>
                {item.label || `Chapter ${i + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reader area */}
      <div className="epub-main">
        <button className="epub-nav-btn epub-nav-prev" onClick={() => renditionRef.current?.prev()}>‹</button>

        <div className="epub-viewer-wrap">
          {loading && <div className="epub-loading">Loading book…</div>}
          {error && <div className="epub-error">{error}</div>}
          <div ref={viewerRef} className="epub-viewer" />
        </div>

        <button className="epub-nav-btn epub-nav-next" onClick={() => renditionRef.current?.next()}>›</button>
      </div>

      {/* Progress bar */}
      <div className="epub-footer">
        <div className="epub-progress-track">
          <div className="epub-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="epub-progress-label">{percent}%</span>
      </div>
    </div>
  );
}
