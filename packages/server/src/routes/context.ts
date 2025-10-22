import { Router } from "express";
import { z } from "zod";
import { buildIndex, saveIndex, loadIndex, searchIndex, packContext } from "../context/indexer";

export const contextRouter = Router();

const IndexBody = z.object({ root: z.string().min(1) });
contextRouter.post("/index", async (req, res) => {
  const parsed = IndexBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { root } = parsed.data;
  try {
    const idx = await buildIndex(root);
    await saveIndex(root, idx);
    res.json({ ok: true, items: idx.items.length, model: idx.model, updatedAt: idx.updatedAt });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "index_failed" });
  }
});

contextRouter.get("/status", async (req, res) => {
  const root = String(req.query.root || "");
  if (!root) return res.status(400).json({ error: "missing root" });
  const idx = await loadIndex(root);
  if (!idx) return res.json({ ok: false, items: 0 });
  res.json({ ok: true, items: idx.items.length, model: idx.model, updatedAt: idx.updatedAt });
});

contextRouter.get("/search", async (req, res) => {
  const root = String(req.query.root || "");
  const q = String(req.query.q || "");
  const k = Math.max(1, Math.min(50, Number(req.query.k || 8)));
  if (!root || !q) return res.status(400).json({ error: "missing root or q" });
  try {
    const { matches } = await searchIndex(root, q, k);
    res.json({ matches, packed: packContext(matches) });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "search_failed" });
  }
});