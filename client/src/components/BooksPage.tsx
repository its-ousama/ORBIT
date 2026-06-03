import { useState, useEffect, useRef, memo } from "react";
import http from "../http";
import {
  getBooks, uploadEpub, deleteBook, getHistory, searchGutenberg, downloadFromGutenberg, rereadBook,
  type Book, type BookHistoryEntry, type GutenbergBook,
} from "../booksAPI";
import EpubReader from "./books/EpubReader";
import PdfReader from "./books/PdfReader";
import "./css/BooksPage.css";

type Tab = "library" | "discover" | "history";

const BOOK_LIMIT = 10;

// Fetches cover via authenticated axios so the Bearer token is included.
// Plain <img src="/api/..."> can't send auth headers — this avoids the 401.
const BookCover = memo(function BookCover({ bookId, title }: { bookId: number; title: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl = "";
    http.get(`/books/${bookId}/cover`, { responseType: "blob" })
      .then(res => {
        objectUrl = URL.createObjectURL(res.data);
        setUrl(objectUrl);
      })
      .catch(() => {}); // fall through to placeholder on error
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [bookId]);

  if (url) return <img src={url} alt={title} />;
  return (
    <div className="book-cover-placeholder">
      {title.charAt(0).toUpperCase()}
    </div>
  );
});

export default function BooksPage() {
  const [tab, setTab] = useState<Tab>("library");
  const [books, setBooks] = useState<Book[]>([]);
  const [history, setHistory] = useState<BookHistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GutenbergBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [readingId, setReadingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [rereading, setRereading] = useState<number | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([fetchBooks(), fetchHistory()]);
  }, []);

  const fetchBooks = async () => {
    try {
      setBooks(await getBooks());
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load library — is the server running?");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistory(await getHistory());
    } catch { /* silent */ }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (books.length >= BOOK_LIMIT) {
      setError(`Library full — ${BOOK_LIMIT} books maximum.`);
      return;
    }
    setUploading(true);
    setError("");
    try {
      await uploadEpub(file);
      await fetchBooks();
    } catch (err: any) {
      setError(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this book from your library?")) return;
    try {
      await deleteBook(id);
      setBooks(prev => prev.filter(b => b.id !== id));
    } catch {
      setError("Delete failed");
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    setHasSearched(true);
    try {
      const data = await searchGutenberg(searchQuery);
      setSearchResults(data.results || []);
    } catch {
      setError("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleDownload = async (gb: GutenbergBook) => {
    if (books.length >= BOOK_LIMIT) {
      setError(`Library full — ${BOOK_LIMIT} books maximum.`);
      return;
    }
    const downloadUrl = gb.formats["application/epub+zip"] || gb.formats["text/plain"] || gb.formats["text/plain; charset=utf-8"];
    if (!downloadUrl) {
      setError("No downloadable format available for this book.");
      return;
    }
    setDownloading(gb.id);
    setError("");
    try {
      const author = gb.authors?.[0]?.name || "";
      const coverUrl = gb.formats["image/jpeg"] || null;
      await downloadFromGutenberg(gb.id, downloadUrl, coverUrl, gb.title, author);
      await fetchBooks();
    } catch (err: any) {
      setError(err.response?.data?.error || "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  const handleReread = async (h: BookHistoryEntry) => {
    if (books.length >= BOOK_LIMIT) {
      setError("Library full — delete a book first to re-read.");
      return;
    }
    setRereading(h.id);
    setError("");
    try {
      await rereadBook(h.id);
      await fetchBooks();
      setTab("library");
    } catch (err: any) {
      if (err.response?.data?.error === "user_upload") {
        setError("This was a personal upload — re-upload the file through the Library tab to read it again.");
      } else {
        setError(err.response?.data?.error || "Failed to re-add the book. Try again.");
      }
    } finally {
      setRereading(null);
    }
  };

  const isInLibrary = (gutenbergId: number) =>
    books.some(b => b.gutenberg_id === String(gutenbergId));

  const readingBook = readingId !== null ? books.find(b => b.id === readingId) : null;

  const handleReaderClose = () => {
    setReadingId(null);
    // Refresh both lists — finished books get auto-deleted server-side, history gains a new entry
    Promise.all([fetchBooks(), fetchHistory()]);
  };

  if (readingId !== null) {
    if (readingBook?.format === "pdf") {
      return <PdfReader bookId={readingId} onClose={handleReaderClose} />;
    }
    return (
      <EpubReader
        bookId={readingId}
        initialLocation={readingBook?.current_location ?? undefined}
        onProgress={(loc, pct) => {
          setBooks(prev =>
            prev.map(b => b.id === readingId ? { ...b, current_location: loc, percent_complete: pct } : b)
          );
        }}
        onClose={handleReaderClose}
      />
    );
  }

  return (
    <div className="books-page">
      <div className="books-header">
        <h1 className="books-title">Library</h1>
        <div className={`books-count ${books.length >= BOOK_LIMIT ? "full" : ""}`}>
          {books.length}/{BOOK_LIMIT}
        </div>
      </div>

      {error && (
        <div className="books-error">
          {error}
          <button className="books-error-close" onClick={() => setError("")}>×</button>
        </div>
      )}

      <div className="books-tabs">
        {(["library", "discover", "history"] as Tab[]).map(t => (
          <button
            key={t}
            className={`books-tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "library" ? "📚 Library" : t === "discover" ? "🔍 Discover" : "📗 History"}
          </button>
        ))}
      </div>

      {/* ── Library Tab ── */}
      {tab === "library" && (
        <div className="books-content">
          <div className="books-upload-row">
            <label className={`books-upload-btn ${uploading ? "loading" : ""} ${books.length >= BOOK_LIMIT ? "disabled" : ""}`}>
              {uploading ? "Uploading…" : "+ Upload EPUB"}
              <input
                ref={fileInputRef}
                type="file"
                accept=".epub"
                onChange={handleUpload}
                hidden
                disabled={uploading || books.length >= BOOK_LIMIT}
              />
            </label>
            <label className={`books-upload-btn books-upload-btn-pdf ${uploading ? "loading" : ""} ${books.length >= BOOK_LIMIT ? "disabled" : ""}`}>
              {uploading ? "Uploading…" : "+ Upload PDF"}
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                onChange={handleUpload}
                hidden
                disabled={uploading || books.length >= BOOK_LIMIT}
              />
            </label>
            {books.length >= BOOK_LIMIT && (
              <span className="books-limit-warn">Library full — delete a book to add more</span>
            )}
          </div>

          {loading ? (
            <div className="books-loading">Loading library…</div>
          ) : books.length === 0 ? (
            <div className="books-empty">
              <div className="books-empty-icon">📖</div>
              <p>Your library is empty.</p>
              <p>Upload an EPUB above or discover free classics in the Discover tab.</p>
            </div>
          ) : (
            <div className="books-grid">
              {books.map(book => (
                <div key={book.id} className="book-card">
                  <div className="book-cover">
                    {book.has_cover
                      ? <BookCover bookId={book.id} title={book.title} />
                      : <div className="book-cover-placeholder">{book.title.charAt(0).toUpperCase()}</div>
                    }
                    {book.finished_at && <div className="book-finished-ribbon">✓</div>}
                  </div>
                  <div className="book-info">
                    <div className="book-card-title">{book.title}</div>
                    <div className="book-card-author">{book.author || "Unknown author"}</div>
                    {book.format === "pdf" ? (
                      <span className="book-format-badge">PDF</span>
                    ) : (
                      <>
                        <div className="book-progress-bar">
                          <div
                            className="book-progress-fill"
                            style={{ width: `${book.percent_complete}%` }}
                          />
                        </div>
                        <div className="book-progress-pct">{book.percent_complete}% read</div>
                      </>
                    )}
                  </div>
                  <div className="book-card-actions">
                    <button className="book-btn-read" onClick={() => setReadingId(book.id)}>
                      {book.percent_complete > 0 ? "Continue" : "Read"}
                    </button>
                    <button className="book-btn-delete" onClick={() => handleDelete(book.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Discover Tab ── */}
      {tab === "discover" && (
        <div className="books-content">
          <p className="gutenberg-note">
            Search for any book — results may take a few seconds to load
          </p>
          <div className="books-search-row">
            <input
              className="books-search-input"
              placeholder="Search by title or author…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
            />
            <button className="books-search-btn" onClick={handleSearch} disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
          {(searching || downloading !== null) && (
            <div className="gutenberg-fetching">
              <span className="gutenberg-spinner" />
              {searching
                ? "Searching Project Gutenberg… this may take a moment"
                : "Fetching your book… this may take a moment"}
            </div>
          )}

          {searchResults.length === 0 && !searching && !hasSearched && (
            <div className="books-empty">
              <div className="books-empty-icon">🔍</div>
              <p>Search for a title or author to find free classics.</p>
            </div>
          )}
          {searchResults.length === 0 && !searching && hasSearched && (
            <div className="books-empty">
              <div className="books-empty-icon">📭</div>
              <p>No results found for that title or author.</p>
              <p>
                This book may not be in the public domain yet.
                Try downloading an EPUB online and adding it through the <strong>Library</strong> tab.
              </p>
            </div>
          )}

          <div className="gutenberg-results">
            {searchResults.map(gr => {
              const added = isInLibrary(gr.id);
              const isDownloading = downloading === gr.id;
              const hasEpub = !!gr.formats["application/epub+zip"];
              return (
                <div key={gr.id} className="gutenberg-card">
                  <div className="gutenberg-cover">
                    {gr.formats["image/jpeg"] ? (
                      <img src={gr.formats["image/jpeg"]} alt={gr.title} />
                    ) : (
                      <div className="book-cover-placeholder">{gr.title.charAt(0)}</div>
                    )}
                  </div>
                  <div className="gutenberg-info">
                    <div className="gutenberg-title">{gr.title}</div>
                    <div className="gutenberg-author">{gr.authors?.[0]?.name || "Unknown"}</div>
                    {!hasEpub && <div className="gutenberg-format-note">Text only — no EPUB</div>}
                  </div>
                  <button
                    className={`book-btn-add ${added ? "added" : ""}`}
                    onClick={() => !added && !isDownloading && handleDownload(gr)}
                    disabled={added || isDownloading || books.length >= BOOK_LIMIT}
                  >
                    {added ? "✓ Added" : isDownloading ? "Adding…" : "Add"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── History Tab ── */}
      {tab === "history" && (
        <div className="books-content">
          {history.length === 0 ? (
            <div className="books-empty">
              <div className="books-empty-icon">📗</div>
              <p>No finished books yet.</p>
              <p>Books you read to the end will appear here permanently.</p>
            </div>
          ) : (
            <div className="history-list">
              {history.map(h => (
                <div key={h.id} className="history-item">
                  <div className="history-cover-dot" />
                  <div className="history-body">
                    <div className="history-title">{h.title}</div>
                    {h.author && <div className="history-author">{h.author}</div>}
                    <div className="history-meta">
                      <span className="history-source">
                        {h.source === "gutenberg" ? "Project Gutenberg" : "EPUB"}
                      </span>
                      <span className="history-date">
                        Finished {new Date(h.finished_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric"
                        })}
                      </span>
                    </div>
                    {h.source === "gutenberg" && h.gutenberg_id ? (
                      <button
                        className="history-reread-btn"
                        onClick={() => handleReread(h)}
                        disabled={rereading === h.id || books.length >= BOOK_LIMIT}
                      >
                        {rereading === h.id ? "Re-adding…" : "↩ Re-read"}
                      </button>
                    ) : (
                      <p className="history-reupload-note">Re-upload the file through Library to read again</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
