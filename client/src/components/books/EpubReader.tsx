import { useEffect, useRef, useState, useCallback } from "react";
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

  const [showUI, setShowUI] = useState(true);
  const autoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoHide = useCallback(() => {
    if (autoHideRef.current) clearTimeout(autoHideRef.current);
  }, []);

  const startAutoHide = useCallback(() => {
    clearAutoHide();
    autoHideRef.current = setTimeout(() => setShowUI(false), 3000);
  }, [clearAutoHide]);

  // Start auto-hide once the book finishes loading
  useEffect(() => {
    if (!loading) startAutoHide();
    return clearAutoHide;
  }, [loading, startAutoHide, clearAutoHide]);

  // Mouse movement on desktop: show UI and reset the hide timer
  useEffect(() => {
    const onMouseMove = () => { setShowUI(true); startAutoHide(); };
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, [startAutoHide]);

  const handleCenterTap = useCallback(() => {
    if (!showUI) {
      setShowUI(true);
      startAutoHide();
    } else {
      clearAutoHide();
      setShowUI(false);
      setShowToc(false);
    }
  }, [showUI, startAutoHide, clearAutoHide]);

  useEffect(() => {
    let destroyed = false;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let lastProgress: { cfi: string; pct: number } | null = null;

    const load = async () => {
      try {
        const res = await http.get(`/books/${bookId}/file`, { responseType: "arraybuffer" });
        if (destroyed) return;

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
        rendition.themes.fontSize(FONT_SIZES[fontSize]);

        let initialDisplayDone = false;

        rendition.on("relocated", (location: any) => {
          const cfi = location?.start?.cfi ?? "";
          const raw = book.locations?.percentageFromCfi
            ? (book.locations.percentageFromCfi(cfi) ?? location?.start?.percentage ?? 0)
            : (location?.start?.percentage ?? 0);
          const pct = Math.min(100, Math.floor(raw * 100));
          setPercent(pct);
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

  useEffect(() => {
    renditionRef.current?.themes.select(darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    renditionRef.current?.themes.fontSize(FONT_SIZES[fontSize]);
  }, [fontSize]);

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

  const uiHidden = !showUI;

  return (
    <div className={`epub-reader ${darkMode ? "epub-dark" : "epub-light"}`}>
      {/* Top bar */}
      <div className={`epub-topbar${uiHidden ? " epub-ui-hidden" : ""}`}>
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
          <div className="epub-tap-overlay">
            <div className="epub-tap-prev" onClick={() => renditionRef.current?.prev()} />
            <div className="epub-tap-center" onClick={handleCenterTap} />
            <div className="epub-tap-next" onClick={() => renditionRef.current?.next()} />
          </div>
        </div>

        <button className="epub-nav-btn epub-nav-next" onClick={() => renditionRef.current?.next()}>›</button>
      </div>

      {/* Progress bar */}
      <div className={`epub-footer${uiHidden ? " epub-ui-hidden" : ""}`}>
        <div className="epub-progress-track">
          <div className="epub-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="epub-progress-label">{percent}%</span>
      </div>
    </div>
  );
}
