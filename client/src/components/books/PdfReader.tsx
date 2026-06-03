import { useEffect, useState } from "react";
import http from "../../http";
import "./EpubReader.css";

interface Props {
  bookId: number;
  onClose: () => void;
}

export default function PdfReader({ bookId, onClose }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let url = "";
    // Use arraybuffer + explicit MIME type so the blob is always application/pdf,
    // regardless of the Content-Type the server sends. A wrong MIME type causes
    // Chrome to show a "Save As" dialog instead of rendering inline.
    http.get(`/books/${bookId}/file`, { responseType: "arraybuffer" })
      .then(res => {
        const blob = new Blob([res.data], { type: "application/pdf" });
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch(() => setError("Failed to load PDF. The file may be corrupted."))
      .finally(() => setLoading(false));

    return () => { if (url) URL.revokeObjectURL(url); };
  }, [bookId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="epub-reader epub-light">
      <div className="epub-topbar">
        <button className="epub-topbar-btn" onClick={onClose}>← Back</button>
        <span className="epub-topbar-format-label">PDF</span>
        <div style={{ width: 60 }} />
      </div>

      {loading && <div className="epub-loading">Loading PDF…</div>}
      {error && <div className="epub-error">{error}</div>}
      {blobUrl && (
        <iframe
          src={blobUrl}
          className="pdf-iframe"
          title="PDF Viewer"
        />
      )}
    </div>
  );
}
