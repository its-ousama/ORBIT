import { Router, Response } from "express";
import multer from "multer";
import JSZip from "jszip";
import axios from "axios";
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
      `SELECT b.id, b.title, b.author, b.file_size, b.source, b.gutenberg_id, b.added_at,
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

// GET /gutenberg/search?q=
router.get("/gutenberg/search", async (req: AuthRequest, res: Response) => {
  const q = (req.query.q as string) || "";
  if (!q.trim()) return res.json({ count: 0, results: [] });
  try {
    const { data } = await axios.get(`https://gutendex.com/books/?search=${encodeURIComponent(q)}`, { timeout: 10000 });
    res.json(data);
  } catch {
    res.status(500).json({ error: "Gutenberg search failed" });
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
    const [meta, cover] = await Promise.all([extractMetadata(buffer), extractCover(buffer)]);

    const { rows } = await pool.query(
      `INSERT INTO books (user_id, title, author, cover_image, epub_data, file_size, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'epub')
       RETURNING id, title, author, file_size, source, added_at`,
      [req.userId, meta.title, meta.author, cover, buffer, buffer.length]
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

// GET /:id/file — streams epub bytes
router.get("/:id/file", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      "SELECT epub_data, title FROM books WHERE id = $1 AND user_id = $2",
      [String(req.params.id), req.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Book not found" });
    res.setHeader("Content-Type", "application/epub+zip");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(rows[0].title)}.epub"`);
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

    // Record history only on first finish
    if (isNowFinished && !wasAlreadyFinished) {
      const bookRes = await pool.query(
        "SELECT title, author, source FROM books WHERE id = $1",
        [bookId]
      );
      if (bookRes.rows[0]) {
        const { title, author, source } = bookRes.rows[0];
        await pool.query(
          `INSERT INTO book_history (user_id, book_id, title, author, source, finished_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.userId, bookId, title, author, source, finishedAt]
        );
      }
    }

    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to update progress" });
  }
});

// GET /gutenberg/:gutenberg_id/download
router.get("/gutenberg/:gutenberg_id/download", async (req: AuthRequest, res: Response) => {
  const gutenbergId = String(req.params.gutenberg_id);

  try {
    const count = await countBooks(req.userId!);
    if (count >= BOOK_LIMIT) {
      return res.status(400).json({ error: `Library full. Maximum ${BOOK_LIMIT} books allowed.` });
    }

    const already = await pool.query(
      "SELECT id FROM books WHERE user_id = $1 AND gutenberg_id = $2",
      [req.userId, gutenbergId]
    );
    if (already.rows.length > 0) {
      return res.status(400).json({ error: "Already in library" });
    }

    // Fetch metadata from Gutendex
    const { data: bookData } = await axios.get(`https://gutendex.com/books/${gutenbergId}`, { timeout: 10000 });
    const title: string = bookData.title || "Unknown";
    const author: string = bookData.authors?.[0]?.name || "";
    const formats: Record<string, string> = bookData.formats || {};

    const epubUrl = formats["application/epub+zip"];
    const textUrl = formats["text/plain"] || formats["text/plain; charset=utf-8"];
    const downloadUrl = epubUrl || textUrl;

    if (!downloadUrl) {
      return res.status(400).json({ error: "No downloadable format available for this book" });
    }

    const fileRes = await axios.get(downloadUrl, { responseType: "arraybuffer", timeout: 30000 });
    const buffer = Buffer.from(fileRes.data);
    const isEpub = !!epubUrl;

    let coverBuffer: Buffer | null = isEpub ? await extractCover(buffer) : null;

    // Fall back to Gutenberg cover image if no embedded cover
    if (!coverBuffer) {
      const imgUrl = formats["image/jpeg"];
      if (imgUrl) {
        try {
          const imgRes = await axios.get(imgUrl, { responseType: "arraybuffer", timeout: 10000 });
          coverBuffer = Buffer.from(imgRes.data);
        } catch { /* no cover */ }
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO books (user_id, title, author, cover_image, epub_data, file_size, source, gutenberg_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'gutenberg', $7)
       RETURNING id, title, author, file_size, source, gutenberg_id, added_at`,
      [req.userId, title, author, coverBuffer, buffer, buffer.length, gutenbergId]
    );

    res.json(rows[0]);
  } catch (e: any) {
    const msg = e?.response?.status === 404 ? "Book not found on Gutenberg" : "Download failed";
    res.status(500).json({ error: msg });
  }
});

export default router;
