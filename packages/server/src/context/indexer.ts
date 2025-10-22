import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline, env, type Pipeline } from "@xenova/transformers";

export type IndexItem = {
  id: string;
  path: string;        // repo-relative posix path
  start: number;       // 1-based line start
  end: number;         // 1-based line end
  text: string;        // snippet (kept for preview)
  vector: number[];    // L2-normalized
  hash: string;        // content hash for change detection
};

export type IndexFile = {
  model: string;
  updatedAt: string;
  items: IndexItem[];
};

const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";

// ------------ Embedding Providers ------------
async function loadEmbedder(): Promise<(text: string) => Promise<number[]>> {
  if (process.env.KIRO_EMBEDDINGS === "mock") {
    // Deterministic 384-dim vector using SHA256 -> floats
    return async (text: string) => {
      const h = crypto.createHash("sha256").update(text).digest();
      const out = new Float32Array(384);
      for (let i = 0; i < out.length; i++) out[i] = (h[i % h.length] / 255) * 2 - 1;
      // L2 normalize
      const n = Math.hypot(...out);
      return Array.from(out, v => v / (n || 1));
    };
  }
  // Transformers.js (local)
  env.allowLocalModels = true;
  let pipe: any = null;
  async function getPipe() {
    if (!pipe) {
      pipe = await pipeline("feature-extraction", DEFAULT_MODEL, { quantized: true });
    }
    return pipe;
  }
  return async (text: string) => {
    const p = await getPipe();
    // @ts-ignore types from transformers.js
    const output = await p(text, { pooling: "mean", normalize: true });
    // output.data is Float32Array
    return Array.from(output.data);
  };
}

// ------------ Utilities ------------
const IGNORE = [
  "**/node_modules/**","**/.git/**","**/.kiro/**","**/dist/**","**/build/**",
  "**/.next/**","**/.cache/**","**/coverage/**","**/*.min.*"
];
const GLOBS = [
  "**/*.{ts,tsx,js,jsx,mjs,cjs}",
  "**/*.{json,md,mdx,yml,yaml,toml}",
  "**/*.{py,go,rs,java,kt,cs,cpp,c,h,php,rb,sql,sh}"
];

function toPosix(p: string) { return p.split(path.sep).join("/"); }

function chunkByLines(text: string, maxChars = 1200, overlap = 200) {
  const lines = text.split(/\r?\n/);
  const chunks: { start: number; end: number; text: string }[] = [];
  let i = 0;
  while (i < lines.length) {
    let cur = "";
    const start = i + 1;
    while (i < lines.length && (cur.length + lines[i].length + 1) <= maxChars) {
      cur += (cur ? "\n" : "") + lines[i];
      i++;
    }
    if (!cur) { cur = lines[i] || ""; i++; }
    const end = i;
    chunks.push({ start, end, text: cur });
    // backtrack overlap
    i = Math.max(i - Math.floor(overlap / Math.max(1, (cur.length / (end - start + 1)))), i);
  }
  return chunks;
}

function sha1(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

export async function buildIndex(root: string): Promise<IndexFile> {
  const embed = await loadEmbedder();
  const entries = await fg(GLOBS, { cwd: root, ignore: IGNORE, dot: false });
  const items: IndexItem[] = [];

  for (const rel of entries) {
    const abs = path.join(root, rel);
    const raw = await fs.readFile(abs, "utf-8").catch(() => "");
    const chunks = chunkByLines(raw);
    for (const c of chunks) {
      const id = sha1(rel + ":" + c.start + ":" + c.end + ":" + sha1(c.text));
      const vector = await embed(c.text);
      items.push({
        id,
        path: toPosix(rel),
        start: c.start,
        end: c.end,
        text: c.text,
        vector,
        hash: sha1(c.text),
      });
    }
  }
  const index: IndexFile = {
    model: process.env.KIRO_EMBEDDINGS === "mock" ? "mock-384" : DEFAULT_MODEL,
    updatedAt: new Date().toISOString(),
    items
  };
  return index;
}

export async function saveIndex(root: string, idx: IndexFile) {
  const dir = path.join(root, ".kiro", "index");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "index.json"), JSON.stringify(idx), "utf-8");
}

export async function loadIndex(root: string): Promise<IndexFile | null> {
  const p = path.join(root, ".kiro", "index", "index.json");
  try {
    const txt = await fs.readFile(p, "utf-8");
    return JSON.parse(txt);
  } catch { return null; }
}

export function cosine(a: number[], b: number[]) {
  let s = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { s += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  const d = (Math.sqrt(na) * Math.sqrt(nb)) || 1;
  return s / d;
}

export async function searchIndex(root: string, query: string, k = 8) {
  const idx = await loadIndex(root);
  if (!idx || idx.items.length === 0) return { matches: [] as (IndexItem & { score:number })[] };
  const embed = await loadEmbedder();
  const qv = await embed(query);
  const scored = idx.items.map(it => ({ ...it, score: cosine(qv, it.vector) }));
  scored.sort((a, b) => b.score - a.score);
  return { matches: scored.slice(0, k) };
}

export function packContext(matches: (IndexItem & {score:number})[], budgetChars = 6000) {
  const lines: string[] = [];
  lines.push("### Project Context (top matches)");
  for (const m of matches) {
    const head = `\n[${m.path}:${m.start}-${m.end}] (score=${m.score.toFixed(3)})`;
    const block = "```" + detectLang(m.path) + "\n" + m.text + "\n```";
    if ((lines.join("\n").length + head.length + block.length) > budgetChars) break;
    lines.push(head, block);
  }
  return lines.join("\n");
}

function detectLang(pth: string) {
  const ext = pth.split(".").pop()?.toLowerCase();
  const map: Record<string,string> = { ts:"ts", tsx:"tsx", js:"js", jsx:"jsx", py:"py", go:"go", rs:"rust",
    java:"java", kt:"kotlin", cs:"cs", cpp:"cpp", c:"c", h:"c", md:"md", json:"json", yml:"yaml", yaml:"yaml", sql:"sql", sh:"bash" };
  return map[ext || ""] || "";
}