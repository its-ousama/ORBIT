import { useEffect, useRef, useState, useCallback } from "react";
import http from "../../http";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "./EpubReader.css";

interface Props {
  bookId: number;
  onClose: () => void;
}

export default function PdfReader({ bookId, onClose }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isMobile = useRef(window.matchMedia("(max-width: 768px)").matches).current;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  const renderingRef = useRef(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [showUI, setShowUI] = useState(true);
  const autoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoHide = useCallback(() => {
    if (autoHideRef.current) clearTimeout(autoHideRef.current);
  }, []);

  const startAutoHide = useCallback(() => {
    clearAutoHide();
    autoHideRef.current = setTimeout(() => setShowUI(false), 3000);
  }, [clearAutoHide]);

  useEffect(() => {
    if (!loading) startAutoHide();
    return clearAutoHide;
  }, [loading, startAutoHide, clearAutoHide]);

  // Mouse movement on desktop only — skip on touch devices to avoid synthetic
  // mousemove events interfering with center-tap toggling.
  useEffect(() => {
    if ("ontouchstart" in window) return;
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
    }
  }, [showUI, startAutoHide, clearAutoHide]);

  useEffect(() => {
    let url = "";
    http.get(`/books/${bookId}/file`, { responseType: "arraybuffer" })
      .then(async res => {
        const blob = new Blob([res.data], { type: "application/pdf" });
        url = URL.createObjectURL(blob);

        if (isMobile) {
          const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
          GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
          const pdf = await getDocument({ url }).promise;
          pdfDocRef.current = pdf;
          setTotalPages(pdf.numPages);
        }

        // Batch with setLoading so the canvas container is in the DOM
        // before the render effect fires (totalPages + blobUrl + loading = false → single render)
        setBlobUrl(url);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load PDF. The file may be corrupted.");
        setLoading(false);
      });

    return () => { if (url) URL.revokeObjectURL(url); };
  }, [bookId]);

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current || !canvasRef.current || !containerRef.current) return;
    if (renderingRef.current) return;
    renderingRef.current = true;
    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const dpr = window.devicePixelRatio || 1;
      const cw = container.clientWidth;
      const ch = container.clientHeight;

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(cw / baseViewport.width, ch / baseViewport.height) * dpr;
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;

      await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    } finally {
      renderingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (isMobile && totalPages > 0 && blobUrl) renderPage(currentPage);
  }, [currentPage, totalPages, blobUrl, renderPage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setCurrentPage(p => Math.min(totalPages || 1, p + 1));
      else if (e.key === "ArrowLeft") setCurrentPage(p => Math.max(1, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, totalPages]);

  const prevPage = () => setCurrentPage(p => Math.max(1, p - 1));
  const nextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1));
  const uiHidden = !showUI;

  return (
    <div className="epub-reader epub-light">
      <div className={`epub-topbar${uiHidden ? " epub-ui-hidden" : ""}`}>
        <button className="epub-topbar-btn" onClick={onClose}>← Back</button>
        <span className="epub-topbar-format-label">PDF</span>
        <div style={{ width: 60 }} />
      </div>

      {loading && <div className="epub-loading">Loading PDF…</div>}
      {error && <div className="epub-error">{error}</div>}

      {blobUrl && !loading && (
        isMobile ? (
          <>
            <div ref={containerRef} className="pdf-mobile-container">
              <canvas ref={canvasRef} />
              <div className="epub-tap-overlay">
                <div className="epub-tap-prev" onClick={prevPage} />
                <div className="epub-tap-center" onClick={handleCenterTap} />
                <div className="epub-tap-next" onClick={nextPage} />
              </div>
            </div>
            <div className={`epub-footer${uiHidden ? " epub-ui-hidden" : ""}`}>
              <div className="epub-progress-track">
                <div className="epub-progress-fill" style={{ width: `${(currentPage / totalPages) * 100}%` }} />
              </div>
              <span className="epub-progress-label">{currentPage}/{totalPages}</span>
            </div>
          </>
        ) : (
          <iframe src={blobUrl} className="pdf-iframe" title="PDF Viewer" />
        )
      )}
    </div>
  );
}
