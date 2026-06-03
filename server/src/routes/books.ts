import { Router, Response } from "express";
import multer from "multer";
import JSZip from "jszip";
import pool from "../db";
import { AuthRequest } from "../middleware/auth";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const BOOK_LIMIT = 10;

async function countBooks(userId: number): Promise<number> {
  const { rows } = await pool.query("SELECT COUNT(*) FROM books WHERE user_id = $1", [userId]);
  return parseInt(rows[0].count, 10);
}

async function extractCover(buffer: Buffer): Promise<Buffer | null> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const containerXml = await zip.file("META-INF/container.xml")?.async("text");
    if (!containerXml) return null;

    const opfPath = containerXml.match(/full-path="([^"]+\.opf)"/)?.[1];
    if (!opfPath) return null;

    const opfContent = await zip.file(opfPath)?.async("text");
    if (!opfContent) return null;

    const opfDir = opfPath.split("/").slice(0, -1).join("/");

    const coverHref =
      opfContent.match(/<item[^>]+properties="cover-image"[^>]*href="([^"]+)"/)?.[1] ||
      opfContent.match(/<item[^>]+href="([^"]*cover[^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*/i)?.[1] ||
      opfContent.match(/<item[^>]+id="cover[^"]*"[^>]*href="([^"]+)"/i)?.[1];

    if (!coverHref) return null;

    const coverPath = opfDir ? `${opfDir}/${coverHref}` : coverHref;
    const coverBuffer = await zip.file(coverPath)?.async("nodebuffer");
    return coverBuffer ?? null;
  } catch {
    return null;
  }
}

async function extractMetadata(buffer: Buffer): Promise<{ title: string; author: string }> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const containerXml = await zip.file("META-INF/container.xml")?.async("text");
    if (!containerXml) return { title: "Unknown", author: "" };

    const opfPath = containerXml.match(/full-path="([^"]+\.opf)"/)?.[1];
    if (!opfPath) return { title: "Unknown", author: "" };

    const opfContent = await zip.file(opfPath)?.async("text");
    if (!opfContent) return { title: "Unknown", author: "" };

    const title = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i)?.[1]?.trim() || "Unknown";
    const author = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i)?.[1]?.trim() || "";

    return { title, author };
  } catch {
    return { title: "Unknown", author: "" };
  }
}

// GET / — list all books with progress (never returns epub_data)
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.title, b.author, b.file_size, b.source, b.format, b.gutenberg_id, b.added_at,
        (b.cover_image IS NOT NULL) AS has_cover,
        bp.current_location, COALESCE(bp.percent_complete, 0) AS percent_complete,
        bp.last_read_at, bp.finished_at
       FROM books b
       LEFT JOIN book_progress bp ON bp.book_id = b.id AND bp.user_id = b.user_id
       WHERE b.user_id = $1
       ORDER BY b.added_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch books" });
  }
});

// GET /history
router.get("/history", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM book_history WHERE user_id = $1 ORDER BY finished_at DESC",
      [req.userId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});


// POST /history/:id/reread — re-download a finished Gutenberg book into the library
router.post("/history/:id/reread", async (req: AuthRequest, res: Response) => {
  const historyId = parseInt(String(req.params.id), 10);
  try {
    const { rows } = await pool.query(
      "SELECT * FROM book_history WHERE id = $1 AND user_id = $2",
      [historyId, req.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: "History entry not found" });

    const entry = rows[0];
    if (entry.source !== "gutenberg" || !entry.gutenberg_id) {
      return res.status(400).json({ error: "user_upload" });
    }

    const count = await countBooks(req.userId!);
    if (count >= BOOK_LIMIT) {
      return res.status(400).json({ error: `Library full. Maximum ${BOOK_LIMIT} books allowed.` });
    }

    const already = await pool.query(
      "SELECT id FROM books WHERE user_id = $1 AND gutenberg_id = $2",
      [req.userId, entry.gutenberg_id]
    );
    if (already.rows.length > 0) {
      return res.status(400).json({ error: "Already in library" });
    }

    const gutendexRes = await fetch(`https://gutendex.com/books/${entry.gutenberg_id}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!gutendexRes.ok) throw new Error(`Gutendex ${gutendexRes.status}`);
    const gbData: any = await gutendexRes.json();

    const downloadUrl: string | undefined =
      gbData.formats?.["application/epub+zip"] ||
      gbData.formats?.["text/plain"] ||
      gbData.formats?.["text/plain; charset=utf-8"];
    if (!downloadUrl) return res.status(400).json({ error: "No downloadable EPUB available for this book." });

    const coverUrl: string | null = gbData.formats?.["image/jpeg"] ?? null;

    const fileR = await fetch(downloadUrl, { signal: AbortSignal.timeout(30000) });
    if (!fileR.ok) throw new Error(`Download HTTP ${fileR.status}`);
    const buffer = Buffer.from(await fileR.arrayBuffer());

    let coverBuffer: Buffer | null = await extractCover(buffer);
    if (!coverBuffer && coverUrl) {
      try {
        const imgR = await fetch(coverUrl, { signal: AbortSignal.timeout(10000) });
        if (imgR.ok) coverBuffer = Buffer.from(await imgR.arrayBuffer());
      } catch { /* no cover */ }
    }

    const { rows: bookRows } = await pool.query(
      `INSERT INTO books (user_id, title, author, cover_image, epub_data, file_size, source, gutenberg_id, format)
       VALUES ($1, $2, $3, $4, $5, $6, 'gutenberg', $7, 'epub')
       RETURNING id, title, author, file_size, source, format, gutenberg_id, added_at`,
      [req.userId, entry.title, entry.author, coverBuffer, buffer, buffer.length, entry.gutenberg_id]
    );
    res.json(bookRows[0]);
  } catch {
    res.status(500).json({ error: "Failed to re-download book. Try again." });
  }
});

// POST /upload
router.post("/upload", upload.single("epub"), async (req: AuthRequest, res: Response) => {
  try {
    const count = await countBooks(req.userId!);
    if (count >= BOOK_LIMIT) {
      return res.status(400).json({ error: `Library full. Maximum ${BOOK_LIMIT} books allowed.` });
    }
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const buffer = req.file.buffer;
    const isPdf = req.file.mimetype === "application/pdf"
      || req.file.originalname.toLowerCase().endsWith(".pdf");
    const format = isPdf ? "pdf" : "epub";

    let meta = { title: "Unknown", author: "" };
    let cover: Buffer | null = null;

    if (isPdf) {
      meta.title = req.file.originalname.replace(/\.pdf$/i, "");
    } else {
      [meta, cover] = await Promise.all([extractMetadata(buffer), extractCover(buffer)]);
    }

    const { rows } = await pool.query(
      `INSERT INTO books (user_id, title, author, cover_image, epub_data, file_size, source, format)
       VALUES ($1, $2, $3, $4, $5, $6, 'epub', $7)
       RETURNING id, title, author, file_size, source, format, added_at`,
      [req.userId, meta.title, meta.author, cover, buffer, buffer.length, format]
    );
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Upload failed" });
  }
});

// DELETE /:id
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    await pool.query("DELETE FROM books WHERE id = $1 AND user_id = $2", [String(req.params.id), req.userId]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Delete failed" });
  }
});

// GET /:id/cover
router.get("/:id/cover", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      "SELECT cover_image FROM books WHERE id = $1 AND user_id = $2",
      [String(req.params.id), req.userId]
    );
    if (!rows[0]?.cover_image) return res.status(404).end();
    res.setHeader("Content-Type", "image/jpeg");
    res.send(rows[0].cover_image);
  } catch {
    res.status(500).end();
  }
});

// GET /:id/file — streams book bytes with correct MIME type per format
router.get("/:id/file", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      "SELECT epub_data, title, format FROM books WHERE id = $1 AND user_id = $2",
      [String(req.params.id), req.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Book not found" });
    const isPdf = rows[0].format === "pdf";
    res.setHeader("Content-Type", isPdf ? "application/pdf" : "application/epub+zip");
    // PDFs use inline so the browser can render them; EPUBs are attachment since epubjs fetches them via XHR
    res.setHeader(
      "Content-Disposition",
      `${isPdf ? "inline" : "attachment"}; filename="${encodeURIComponent(rows[0].title)}.${isPdf ? "pdf" : "epub"}"`
    );
    res.send(rows[0].epub_data);
  } catch {
    res.status(500).json({ error: "Failed to stream file" });
  }
});

// PUT /:id/progress
router.put("/:id/progress", async (req: AuthRequest, res: Response) => {
  const { current_location, percent_complete } = req.body;
  const bookId = parseInt(String(req.params.id), 10);

  try {
    // Check if this is a new finish event
    const existing = await pool.query(
      "SELECT finished_at FROM book_progress WHERE user_id = $1 AND book_id = $2",
      [req.userId, bookId]
    );
    const wasAlreadyFinished = existing.rows[0]?.finished_at != null;
    const isNowFinished = percent_complete >= 98;
    const finishedAt = isNowFinished ? new Date().toISOString() : null;

    const { rows } = await pool.query(
      `INSERT INTO book_progress (user_id, book_id, current_location, percent_complete, last_read_at, finished_at)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       ON CONFLICT (user_id, book_id) DO UPDATE SET
         current_location = EXCLUDED.current_location,
         percent_complete = EXCLUDED.percent_complete,
         last_read_at = NOW(),
         finished_at = CASE
           WHEN EXCLUDED.finished_at IS NOT NULL THEN EXCLUDED.finished_at
           ELSE book_progress.finished_at
         END
       RETURNING *`,
      [req.userId, bookId, current_location, percent_complete, finishedAt]
    );

    // Record history and free library slot on first finish
    if (isNowFinished && !wasAlreadyFinished) {
      const bookRes = await pool.query(
        "SELECT title, author, source, gutenberg_id FROM books WHERE id = $1",
        [bookId]
      );
      if (bookRes.rows[0]) {
        const { title, author, source, gutenberg_id } = bookRes.rows[0];
        await pool.query(
          `INSERT INTO book_history (user_id, book_id, title, author, source, gutenberg_id, finished_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [req.userId, bookId, title, author, source, gutenberg_id, finishedAt]
        );
        // Auto-delete from library — history preserves metadata, slot is freed
        await pool.query("DELETE FROM books WHERE id = $1", [bookId]);
      }
    }

    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to update progress" });
  }
});

// POST /gutenberg/save — client already resolved the URLs from gutendex, server just downloads + stores
router.post("/gutenberg/save", async (req: AuthRequest, res: Response) => {
  const { gutenberg_id, download_url, cover_url, title, author } = req.body;

  if (!download_url) return res.status(400).json({ error: "No download URL provided" });

  try {
    const count = await countBooks(req.userId!);
    if (count >= BOOK_LIMIT) {
      return res.status(400).json({ error: `Library full. Maximum ${BOOK_LIMIT} books allowed.` });
    }

    const already = await pool.query(
      "SELECT id FROM books WHERE user_id = $1 AND gutenberg_id = $2",
      [req.userId, String(gutenberg_id)]
    );
    if (already.rows.length > 0) {
      return res.status(400).json({ error: "Already in library" });
    }

    const fileR = await fetch(download_url, { signal: AbortSignal.timeout(30000) });
    if (!fileR.ok) throw new Error(`HTTP ${fileR.status}`);
    const buffer = Buffer.from(await fileR.arrayBuffer());

    const isEpub = download_url.includes(".epub") || download_url.includes("epub");
    let coverBuffer: Buffer | null = isEpub ? await extractCover(buffer) : null;

    if (!coverBuffer && cover_url) {
      try {
        const imgR = await fetch(cover_url, { signal: AbortSignal.timeout(10000) });
        if (imgR.ok) coverBuffer = Buffer.from(await imgR.arrayBuffer());
      } catch { /* no cover */ }
    }

    const { rows } = await pool.query(
      `INSERT INTO books (user_id, title, author, cover_image, epub_data, file_size, source, gutenberg_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'gutenberg', $7)
       RETURNING id, title, author, file_size, source, gutenberg_id, added_at`,
      [req.userId, title || "Unknown", author || "", coverBuffer, buffer, buffer.length, String(gutenberg_id)]
    );

    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Download failed" });
  }
});

export default router;
