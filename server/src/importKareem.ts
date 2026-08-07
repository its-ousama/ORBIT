/**
 * One-time importer for Kareem's "Kuwait Spread Sheet.xlsx".
 *
 * Reads the two raw transaction tabs ("Out Data Dump" = expenses,
 * "In Data Dump" = income), auto-creates any missing finance categories,
 * and bulk-inserts every transaction under a given user account.
 *
 * Everything else in the finance app (monthly summaries, balances, charts)
 * is derived from finance_transactions, so no summaries need importing.
 *
 * Usage (from server/):
 *   npx ts-node src/importKareem.ts --email kareem@example.com --file "../excel/kareem/Kuwait Spread Sheet (3).xlsx"
 *   ...add --dry-run to preview without writing
 *   ...add --force to import even if the user already has transactions
 *   ...add --currency KWD to set the finance currency (default KWD)
 */
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import pool from "./db";
import dotenv from "dotenv";
dotenv.config();

// ── CLI args ────────────────────────────────────────────────────────────────
function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && i + 1 < process.argv.length) return process.argv[i + 1];
  return def;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

const EMAIL = arg("email");
const FILE = arg("file", "../excel/kareem/Kuwait Spread Sheet (3).xlsx")!;
const CURRENCY = (arg("currency", "KWD") || "KWD").toUpperCase();
const DRY = hasFlag("dry-run");
const FORCE = hasFlag("force");

// ── xlsx (zip + XML) parsing ─────────────────────────────────────────────────
function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}
function colOf(ref: string): string {
  return ref.replace(/\d+/g, "");
}

type Row = { r: number; cells: Record<string, string> };

async function readWorkbook(filePath: string) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);

  const read = async (p: string) => {
    const f = zip.file(p);
    if (!f) throw new Error(`Missing ${p} in xlsx`);
    return f.async("string");
  };

  // shared strings
  const shared: string[] = [];
  if (zip.file("xl/sharedStrings.xml")) {
    const raw = await read("xl/sharedStrings.xml");
    const siRe = /<si>([\s\S]*?)<\/si>/g;
    let m: RegExpExecArray | null;
    while ((m = siRe.exec(raw))) {
      const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
      let t: RegExpExecArray | null, s = "";
      while ((t = tRe.exec(m[1]))) s += t[1];
      shared.push(decode(s));
    }
  }

  // sheet name -> worksheet file
  const wb = await read("xl/workbook.xml");
  const rels = await read("xl/_rels/workbook.xml.rels");
  const relMap: Record<string, string> = {};
  let rm: RegExpExecArray | null;
  const relRe = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
  while ((rm = relRe.exec(rels))) relMap[rm[1]] = rm[2];
  const sheetMap: Record<string, string> = {};
  let sm: RegExpExecArray | null;
  const shRe = /<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g;
  while ((sm = shRe.exec(wb))) {
    const target = relMap[sm[2]] || "";
    sheetMap[decode(sm[1])] = "xl/" + target.replace(/^\//, "");
  }

  const parseSheet = async (name: string): Promise<Row[]> => {
    const file = sheetMap[name];
    if (!file) throw new Error(`Sheet "${name}" not found. Tabs: ${Object.keys(sheetMap).join(", ")}`);
    const raw = await read(file);
    const rows: Row[] = [];
    const rowRe = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
    let r: RegExpExecArray | null;
    while ((r = rowRe.exec(raw))) {
      const cells: Record<string, string> = {};
      const cRe = /<c[^>]*r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>|<c[^>]*r="([A-Z]+\d+)"([^>]*)\/>/g;
      let c: RegExpExecArray | null;
      while ((c = cRe.exec(r[2]))) {
        const ref = c[1] || c[4];
        const attrs = (c[2] || c[5]) || "";
        const body = c[3] || "";
        const tM = /t="([^"]+)"/.exec(attrs);
        const type = tM ? tM[1] : "n";
        let val = "";
        const vM = /<v>([\s\S]*?)<\/v>/.exec(body);
        const isM = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(body);
        if (type === "s" && vM) val = shared[parseInt(vM[1])] ?? "";
        else if (type === "inlineStr" && isM) val = decode(isM[1]);
        else if (vM) val = vM[1];
        cells[colOf(ref)] = val;
      }
      rows.push({ r: parseInt(r[1]), cells });
    }
    return rows;
  };

  return { parseSheet };
}

// Excel serial date -> "YYYY-MM-DD" (1900 date system, incl. the leap bug baseline)
function serialToDate(serial: string): string | null {
  const n = parseFloat(serial);
  if (!isFinite(n)) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.round(n) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

// ── Category presentation defaults ────────────────────────────────────────────
const ICONS: Record<string, string> = {
  food: "🍔", groceries: "🛒", taxi: "🚕", coffee: "☕", rent: "🏠",
  utilities: "💡", haircut: "💈", cleaning: "🧼", "dry cleaning": "🧺",
  hospital: "🏥", clothing: "👕", furniture: "🛋️", electronics: "🔌",
  fishing: "🎣", ticket: "🎫", cashback: "💸", other: "📦", toleb: "📦",
  salary: "💼", reimbursment: "↩️", reimbursement: "↩️", transfer: "🔁",
  exchange: "💱", pokemon: "🎮", "folder 1": "📁", "folder 2": "📁",
};
const PALETTE = ["#6366f1", "#ef4444", "#f59e0b", "#10b981", "#3b82f6",
  "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#84cc16", "#06b6d4", "#e11d48"];

type Tx = { date: string; category: string; amount: number; note: string; type: "income" | "expense" };

function collectRows(rows: Row[], dateCol: string, catCol: string, amtCol: string,
                     noteCol: string | null, type: "income" | "expense"): Tx[] {
  const out: Tx[] = [];
  for (const rw of rows) {
    const dv = rw.cells[dateCol], cv = rw.cells[catCol], av = rw.cells[amtCol];
    if (dv === undefined || cv === undefined || av === undefined) continue;
    const date = serialToDate(dv);
    const amount = parseFloat(av);
    const category = String(cv).trim();
    // skip header / non-data rows (date not a serial, amount not numeric, empty category)
    if (!date || !isFinite(amount) || !category) continue;
    const note = noteCol ? String(rw.cells[noteCol] ?? "").trim() : "";
    out.push({ date, category, amount, note, type });
  }
  return out;
}

async function main() {
  if (!EMAIL) {
    console.error("ERROR: --email is required (Kareem's Orbit login email).");
    process.exit(1);
  }
  const absFile = path.resolve(FILE);
  if (!fs.existsSync(absFile)) {
    console.error(`ERROR: file not found: ${absFile}`);
    process.exit(1);
  }

  // resolve user
  const u = await pool.query("SELECT id, email, username FROM users WHERE LOWER(email) = LOWER($1)", [EMAIL]);
  if (u.rows.length === 0) {
    const all = await pool.query("SELECT email FROM users ORDER BY id");
    console.error(`ERROR: no user with email "${EMAIL}". Existing users: ${all.rows.map((r: any) => r.email).join(", ")}`);
    process.exit(1);
  }
  const userId: number = u.rows[0].id;
  console.log(`Target user: ${u.rows[0].username} <${u.rows[0].email}> (id=${userId})`);
  console.log(`Source file: ${absFile}`);
  console.log(DRY ? "MODE: DRY RUN (no writes)\n" : "MODE: LIVE\n");

  // parse
  const { parseSheet } = await readWorkbook(absFile);
  const outRows = await parseSheet("Out Data Dump");
  const inRows = await parseSheet("In Data Dump");
  const expenses = collectRows(outRows, "B", "C", "D", "E", "expense");
  const income = collectRows(inRows, "B", "C", "D", null, "income");
  const txs = [...expenses, ...income];

  if (txs.length === 0) {
    console.error("ERROR: parsed 0 transactions — aborting.");
    process.exit(1);
  }

  // category type by first appearance (case-insensitive key)
  const catType = new Map<string, { display: string; type: "income" | "expense" }>();
  for (const t of txs) {
    const key = t.category.toLowerCase();
    if (!catType.has(key)) catType.set(key, { display: t.category, type: t.type });
  }

  const expTotal = expenses.reduce((s, t) => s + t.amount, 0);
  const incTotal = income.reduce((s, t) => s + t.amount, 0);
  const dates = txs.map((t) => t.date).sort();
  console.log(`Parsed: ${expenses.length} expenses (${expTotal.toFixed(2)}), ${income.length} income (${incTotal.toFixed(2)})`);
  console.log(`Date range: ${dates[0]} → ${dates[dates.length - 1]}`);
  console.log(`Categories to ensure (${catType.size}): ${[...catType.values()].map((c) => `${c.display}[${c.type[0]}]`).join(", ")}\n`);

  // safety: existing data guard
  const existing = await pool.query("SELECT COUNT(*)::int AS n FROM finance_transactions WHERE user_id = $1", [userId]);
  if (existing.rows[0].n > 0 && !FORCE) {
    console.error(`ABORT: user already has ${existing.rows[0].n} transactions. Re-run with --force to import anyway.`);
    process.exit(1);
  }

  if (DRY) {
    console.log("Dry run complete — nothing written. Re-run without --dry-run to import.");
    process.exit(0);
  }

  // ── write ───────────────────────────────────────────────────────────────────
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ensure categories
    const existingCats = await client.query(
      "SELECT id, name, type FROM finance_categories WHERE user_id = $1", [userId]);
    const catId = new Map<string, number>();
    for (const c of existingCats.rows) catId.set(String(c.name).toLowerCase(), c.id);

    let colorIdx = 0, created = 0;
    for (const [key, info] of catType) {
      if (catId.has(key)) continue;
      const icon = ICONS[key] || (info.type === "income" ? "💵" : "💰");
      const color = PALETTE[colorIdx++ % PALETTE.length];
      const ins = await client.query(
        `INSERT INTO finance_categories (name, icon, color, monthly_budget, type, user_id)
         VALUES ($1, $2, $3, 0, $4, $5) RETURNING id`,
        [info.display, icon, color, info.type, userId]);
      catId.set(key, ins.rows[0].id);
      created++;
    }
    console.log(`Categories: ${created} created, ${existingCats.rows.length} already existed.`);

    // insert transactions
    let n = 0;
    for (const t of txs) {
      const cid = catId.get(t.category.toLowerCase()) ?? null;
      await client.query(
        `INSERT INTO finance_transactions
           (amount, type, category_id, date, note, is_recurring, recurring_id, is_goal, user_id)
         VALUES ($1, $2, $3, $4, $5, false, null, false, $6)`,
        [t.amount, t.type, cid, t.date, t.note, userId]);
      n++;
    }
    console.log(`Transactions: ${n} inserted.`);

    // currency (best-effort — requires finance_config row to exist)
    const cfg = await client.query("SELECT id FROM finance_config WHERE user_id = $1 LIMIT 1", [userId]);
    if (cfg.rows.length > 0) {
      await client.query("UPDATE finance_config SET currency = $1 WHERE user_id = $2", [CURRENCY, userId]);
      console.log(`Currency: set to ${CURRENCY}.`);
    } else {
      console.log(`Currency: NOT set — Kareem hasn't set up his finance PIN yet. After he does, set currency to ${CURRENCY} in Finance settings.`);
    }

    await client.query("COMMIT");
    console.log("\n✅ Import committed successfully.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("\n❌ Import failed, rolled back:", e);
    process.exit(1);
  } finally {
    client.release();
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
