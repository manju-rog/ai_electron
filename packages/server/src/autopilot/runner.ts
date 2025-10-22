import fs from "node:fs/promises";
import path from "node:path";
import * as diff from "diff";

// Simple ID generator for compatibility
function generateId(length = 10): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

import { resolveProvider } from "../providers";
import type { ChatRequest } from "../providers/types";
import { searchIndex, packContext } from "../context/indexer";
import { spawn } from "node:child_process";

export type PatchHunk = {
  file: string;
  mode: "replaceWhole" | "hunks";
  newContent?: string; // for replaceWhole mode
  diff?: string; // unified diff for hunks mode
  explanation?: string;
  approved?: boolean; // for selective approval
};

export type AutoStep = {
  id: string;
  title: string;
  rationale?: string;
  targetFiles?: string[];
  status: "pending" | "staged" | "approved" | "applied" | "tested" | "skipped" | "error";
  patches?: PatchHunk[];
  test?: { ok: boolean; output: string };
  error?: string;
};

export type AutoJob = {
  id: string;
  root: string;
  provider: "auto" | "anthropic" | "openai" | "mock";
  model: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
  state: "planning" | "awaiting-approval" | "running" | "testing" | "done" | "aborted" | "error";
  steps: AutoStep[];
  log: { time: string; msg: string }[];
  waitingStepId?: string; // step that is staged and needs approval
};

const PLAN_SYS = `You are AUTOPILOT for a local IDE. Return ONLY valid JSON, no markdown, no code fences, no explanatory text.

Schema:
{
  "steps": [
    {
      "title": "short imperative",
      "rationale": "why this step",
      "targetFiles": ["relative/path.ts", "..."]
    }
  ]
}

CRITICAL: Return ONLY the JSON object. No \`\`\`json, no markdown, no other text. Start with { and end with }.

Rules:
- 2-5 steps max.
- targetFiles may be empty; it's okay to infer later.`;

const PATCH_SYS = `You are a software editor. Return ONLY valid JSON, no markdown, no code fences, no explanatory text.

Schema:
{
  "patches": [
    {
      "file": "<relative path>",
      "mode": "replaceWhole" | "hunks",
      "newContent": "<full file after edits>", // for replaceWhole mode
      "diff": "<unified diff>", // for hunks mode
      "explanation": "<what changed and why>"
    }
  ]
}

CRITICAL: Return ONLY the JSON object. No \`\`\`json, no markdown, no other text. Start with { and end with }.

Rules:
- Use "replaceWhole" for complete file rewrites or small files
- Use "hunks" with unified diff for targeted changes in large files
- Keep behavior, add clarity (JSDoc, small refactors), or implement the requested feature
- If nothing to change, return {"patches": []}`;

function now() { return new Date().toISOString(); }
const toPosix = (p: string) => p.replace(/\\/g, "/");

async function ensureKiroDirs(root: string) {
  const kiro = path.join(root, ".kiro");
  const staging = path.join(kiro, "staging");
  const jobs = path.join(kiro, "autopilot");
  await fs.mkdir(staging, { recursive: true });
  await fs.mkdir(jobs, { recursive: true });
  return { kiro, staging, jobs };
}

async function writeJob(root: string, job: AutoJob) {
  const { jobs } = await ensureKiroDirs(root);
  await fs.writeFile(path.join(jobs, `${job.id}.json`), JSON.stringify(job, null, 2), "utf-8");
}

async function readFileMaybe(abs: string) {
  try { return await fs.readFile(abs, "utf-8"); } catch { return ""; }
}

async function runTests(root: string): Promise<{ ok: boolean; output: string }> {
  // Try pnpm test -> npm test -> no-op if none
  const pkgPath = path.join(root, "package.json");
  const pkgJSON = await readFileMaybe(pkgPath);
  const hasPkg = !!pkgJSON;
  if (!hasPkg) return { ok: true, output: "No package.json; skipping tests." };

  const hasTestScript = pkgJSON.includes('"test"');
  if (!hasTestScript) return { ok: true, output: "No test script found; skipping tests." };

  const preferPnpm = pkgJSON.includes("pnpm");
  const cmd = preferPnpm ? "pnpm" : "npm";
  const args = ["test", "--silent"];

  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: root, shell: true });
    let buff = "";
    child.stdout?.on("data", (d) => buff += d.toString());
    child.stderr?.on("data", (d) => buff += d.toString());
    child.on("close", (code) => resolve({ ok: code === 0, output: buff }));
    child.on("error", (err) => resolve({ ok: false, output: `Test execution error: ${err.message}` }));
    // Timeout after 2 minutes
    setTimeout(() => {
      try { child.kill(); } catch { }
      resolve({ ok: false, output: buff + "\n[timeout after 2 minutes]" });
    }, 120000);
  });
}

// Path validation helper
function isValidRelativePath(relPath: string): boolean {
  const normalized = path.normalize(relPath);
  return !path.isAbsolute(normalized) && !normalized.startsWith('..');
}

export class AutopilotRunner {
  job: AutoJob;

  constructor(root: string, provider: AutoJob["provider"], model: string, prompt: string) {
    this.job = {
      id: generateId(10),
      root,
      provider,
      model,
      prompt,
      createdAt: now(),
      updatedAt: now(),
      state: "planning",
      steps: [],
      log: []
    };
  }

  log(m: string) {
    this.job.log.unshift({ time: now(), msg: m });
    this.job.updatedAt = now();
    // Persist job state
    writeJob(this.job.root, this.job).catch(console.error);
  }

  async plan(): Promise<void> {
    this.log("Planning steps…");
    const { provider, model, prompt, root } = this.job;

    try {
      // Pack local context for a stronger plan
      const ctx = await searchIndex(root, prompt, 8)
        .then(r => packContext(r.matches, 5000))
        .catch(() => "");
      const user = `GOAL:\n${prompt}\n\n${ctx ? (ctx + "\n") : ""}Return only the plan JSON.`;

      const req: ChatRequest = {
        provider, model,
        messages: [
          { role: "system", content: PLAN_SYS },
          { role: "user", content: user }
        ],
        maxTokens: 2048
      };

      const out = await resolveProvider(req).chat(req);
      let plan: any = {};
      try {
        // Clean Claude's response - remove code fences and extra text
        let cleanContent = (out.content || "").trim();
        if (cleanContent.includes('```json')) {
          cleanContent = cleanContent.split('```json')[1].split('```')[0].trim();
        } else if (cleanContent.includes('```')) {
          cleanContent = cleanContent.split('```')[1].split('```')[0].trim();
        }
        // Find JSON object boundaries
        const startIdx = cleanContent.indexOf('{');
        const lastIdx = cleanContent.lastIndexOf('}');
        if (startIdx !== -1 && lastIdx !== -1 && lastIdx > startIdx) {
          cleanContent = cleanContent.substring(startIdx, lastIdx + 1);
        }
        plan = JSON.parse(cleanContent);
      } catch (parseError) {
        this.log(`Plan parsing failed: ${parseError}. Raw content: ${out.content?.slice(0, 200)}`);
        plan = { steps: [{ title: "Implement requested change", rationale: "default fallback" }] };
      }

      const steps = Array.isArray(plan.steps) ? plan.steps : [{ title: "Implement requested change", rationale: "default" }];

      this.job.steps = steps.map((s: any) => ({
        id: generateId(6),
        title: String(s.title || "Step"),
        rationale: typeof s.rationale === "string" ? s.rationale : undefined,
        targetFiles: Array.isArray(s.targetFiles) ?
          s.targetFiles.map((p: string) => toPosix(p)).filter(isValidRelativePath) :
          undefined,
        status: "pending" as const
      }));

      this.job.state = "running";
      this.log(`Planned ${this.job.steps.length} step(s).`);
    } catch (error: any) {
      this.job.state = "error";
      this.log(`Planning failed: ${error?.message || error}`);
      throw error;
    }
  }

  async executeStep(step: AutoStep): Promise<void> {
    const { root, provider, model, prompt } = this.job;
    this.log(`Executing: ${step.title}`);

    try {
      // Grab some contextual matches for this step title
      const ctx = await searchIndex(root, (step.title + " " + (step.rationale || "")), 6)
        .then(r => packContext(r.matches, 4000))
        .catch(() => "");
      const steering = await readFileMaybe(path.join(root, ".steering.md"));

      // Build user content
      const goal = [
        `PROJECT GOAL: ${prompt}`,
        `STEP GOAL: ${step.title}${step.rationale ? `\nRATIONALE: ${step.rationale}` : ""}`,
        step.targetFiles && step.targetFiles.length ? `TARGET FILES: ${step.targetFiles.join(", ")}` : null,
        steering ? `STEERING:\n${steering}` : null,
        ctx ? ctx : null
      ].filter(Boolean).join("\n\n");

      const req: ChatRequest = {
        provider, model,
        messages: [
          { role: "system", content: PATCH_SYS },
          { role: "user", content: goal + `\n\nRespond only with JSON per schema.` }
        ],
        maxTokens: 4096
      };

      const out = await resolveProvider(req).chat(req);
      let patches: any[] = [];
      try {
        // Clean Claude's response - remove code fences and extra text
        let cleanContent = (out.content || "").trim();
        if (cleanContent.includes('```json')) {
          cleanContent = cleanContent.split('```json')[1].split('```')[0].trim();
        } else if (cleanContent.includes('```')) {
          cleanContent = cleanContent.split('```')[1].split('```')[0].trim();
        }
        // Find JSON object boundaries
        const startIdx = cleanContent.indexOf('{');
        const lastIdx = cleanContent.lastIndexOf('}');
        if (startIdx !== -1 && lastIdx !== -1 && lastIdx > startIdx) {
          cleanContent = cleanContent.substring(startIdx, lastIdx + 1);
        }
        const obj = JSON.parse(cleanContent);
        patches = Array.isArray(obj.patches) ? obj.patches : [];
      } catch (parseError) {
        this.log(`Patch parsing failed: ${parseError}. Raw content: ${out.content?.slice(0, 200)}`);
        patches = [];
      }

      // Stage patches with validation
      const { staging } = await ensureKiroDirs(root);
      let stagedCount = 0;
      for (const p of patches) {
        if (!p || typeof p.file !== "string") continue;
        const rel = toPosix(p.file).replace(/^\/+/, "").replace(/\.\.+/g, ".");
        if (!isValidRelativePath(rel)) {
          this.log(`Skipping invalid path: ${rel}`);
          continue;
        }

        const stagedAbs = path.join(staging, rel);
        await fs.mkdir(path.dirname(stagedAbs), { recursive: true });

        let finalContent = "";

        if (p.mode === "hunks" && p.diff) {
          // Apply unified diff to existing file
          const originalPath = path.join(root, rel);
          const originalContent = await readFileMaybe(originalPath);

          try {
            // Parse and apply the unified diff
            const patches = diff.parsePatch(p.diff);
            if (patches.length > 0) {
              finalContent = diff.applyPatch(originalContent, patches[0]) || originalContent;
            } else {
              finalContent = originalContent;
              this.log(`Failed to parse diff for ${rel}, keeping original`);
            }
          } catch (diffError) {
            this.log(`Diff application failed for ${rel}: ${diffError}`);
            finalContent = originalContent;
          }
        } else if (p.mode === "replaceWhole" && p.newContent) {
          finalContent = p.newContent;
        } else {
          this.log(`Invalid patch mode or missing content for ${rel}`);
          continue;
        }

        await fs.writeFile(stagedAbs, finalContent, "utf-8");
        await fs.writeFile(stagedAbs + ".explain.txt", String(p.explanation || ""), "utf-8");
        await fs.writeFile(stagedAbs + ".mode.txt", p.mode || "replaceWhole", "utf-8");
        if (p.diff) {
          await fs.writeFile(stagedAbs + ".diff.txt", p.diff, "utf-8");
        }
        stagedCount++;
      }

      step.patches = patches
        .filter(p => p && typeof p.file === "string" && isValidRelativePath(toPosix(p.file)))
        .map((p: any) => ({
          file: toPosix(p.file),
          mode: p.mode || "replaceWhole",
          newContent: p.mode === "replaceWhole" ? String(p.newContent || "") : undefined,
          diff: p.mode === "hunks" ? String(p.diff || "") : undefined,
          explanation: p.explanation,
          approved: false // Default to not approved for selective approval
        }));

      step.status = "staged";
      this.job.state = "awaiting-approval";
      this.job.waitingStepId = step.id;
      this.log(`Staged ${stagedCount} file(s) for review in .kiro/staging. Awaiting approval.`);
    } catch (error: any) {
      step.status = "error";
      step.error = error?.message || String(error);
      this.job.state = "error";
      this.log(`Step execution failed: ${step.error}`);
      throw error;
    }
  }

  async applyApproved(step: AutoStep, selectedFiles?: string[]): Promise<void> {
    const { root } = this.job;
    const { staging } = await ensureKiroDirs(root);
    if (!step.patches || !step.patches.length) {
      step.status = "approved";
      this.log(`No patches to apply for step: ${step.title}`);
      return;
    }

    try {
      let appliedCount = 0;
      let skippedCount = 0;

      for (const p of step.patches) {
        // Skip if selective approval is used and this file is not selected
        if (selectedFiles && !selectedFiles.includes(p.file)) {
          skippedCount++;
          this.log(`Skipped ${p.file} (not in selected files)`);
          continue;
        }

        // Skip if patch is explicitly not approved
        if (p.approved === false && selectedFiles) {
          skippedCount++;
          this.log(`Skipped ${p.file} (not approved)`);
          continue;
        }

        const staged = path.join(staging, p.file);
        const target = path.join(root, p.file);

        // Additional security check
        if (!isValidRelativePath(p.file)) {
          this.log(`Skipping invalid target path: ${p.file}`);
          continue;
        }

        const data = await readFileMaybe(staged);
        if (!data) {
          this.log(`No staged content found for: ${p.file}`);
          continue;
        }

        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, data, "utf-8");

        // Cleanup staged files
        await fs.rm(staged, { force: true }).catch(() => { });
        await fs.rm(staged + ".explain.txt", { force: true }).catch(() => { });
        await fs.rm(staged + ".mode.txt", { force: true }).catch(() => { });
        await fs.rm(staged + ".diff.txt", { force: true }).catch(() => { });

        appliedCount++;
        this.log(`Applied ${p.mode} patch to ${p.file}`);
      }

      step.status = "applied";
      this.log(`Applied ${appliedCount} file(s), skipped ${skippedCount} file(s) to workspace.`);
    } catch (error: any) {
      step.status = "error";
      step.error = error?.message || String(error);
      this.log(`Apply failed: ${step.error}`);
      throw error;
    }
  }

  async runTestsForStep(step: AutoStep): Promise<void> {
    this.job.state = "testing";
    this.log(`Running tests for step: ${step.title}`);

    try {
      const res = await runTests(this.job.root);
      step.test = res;
      step.status = "tested";
      this.log(`Tests ${res.ok ? "passed" : "failed"}.`);
      this.job.state = "running";
    } catch (error: any) {
      step.status = "error";
      step.error = error?.message || String(error);
      step.test = { ok: false, output: `Test execution error: ${step.error}` };
      this.log(`Test execution failed: ${step.error}`);
      this.job.state = "running"; // Continue despite test failures
    }
  }
}