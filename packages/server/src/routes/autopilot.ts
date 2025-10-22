import { Router } from "express";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { AutopilotRunner, type AutoJob } from "../autopilot/runner";

export const autopilotRouter = Router();

// In-memory job storage with disk persistence
const jobs = new Map<string, AutopilotRunner>();

// Helper to persist job to disk
async function persistJob(runner: AutopilotRunner): Promise<void> {
  try {
    const jobsDir = path.join(runner.job.root, ".kiro", "autopilot");
    await fs.mkdir(jobsDir, { recursive: true });
    const jobFile = path.join(jobsDir, `${runner.job.id}.json`);
    await fs.writeFile(jobFile, JSON.stringify(runner.job, null, 2), "utf-8");
  } catch (error) {
    console.error(`Failed to persist job ${runner.job.id}:`, error);
  }
}

// Helper to load job from disk
async function loadJob(root: string, jobId: string): Promise<AutoJob | null> {
  try {
    const jobFile = path.join(root, ".kiro", "autopilot", `${jobId}.json`);
    const data = await fs.readFile(jobFile, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

const Start = z.object({
  root: z.string().min(1),
  prompt: z.string().min(4),
  provider: z.enum(["auto","anthropic","openai","mock"]).default("auto"),
  model: z.string().default("claude-sonnet-4")
});

const IdParam = z.object({
  id: z.string().min(1)
});

const ApproveBody = z.object({
  selectedFiles: z.array(z.string()).optional(),
  approveAll: z.boolean().default(true)
});

autopilotRouter.post("/start", async (req, res) => {
  const p = Start.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const { root, prompt, provider, model } = p.data;
  
  try {
    const runner = new AutopilotRunner(root, provider, model, prompt);
    jobs.set(runner.job.id, runner);
    
    // Plan and execute first step
    await runner.plan();
    if (runner.job.steps.length > 0) {
      await runner.executeStep(runner.job.steps[0]); // stage first step and pause
    } else {
      runner.job.state = "done";
      runner.log("No steps planned - job complete.");
    }
    
    // Persist job to disk
    await persistJob(runner);
    
    res.json({ id: runner.job.id, job: runner.job });
  } catch (e: any) {
    console.error("Autopilot start error:", e);
    res.status(500).json({ error: e?.message || "autopilot_failed" });
  }
});

autopilotRouter.get("/:id/status", async (req, res) => {
  const paramCheck = IdParam.safeParse(req.params);
  if (!paramCheck.success) return res.status(400).json({ error: "invalid_id" });
  
  const r = jobs.get(paramCheck.data.id);
  if (!r) return res.status(404).json({ error: "not_found" });
  res.json(r.job);
});

autopilotRouter.post("/:id/approve", async (req, res) => {
  const paramCheck = IdParam.safeParse(req.params);
  if (!paramCheck.success) return res.status(400).json({ error: "invalid_id" });
  
  const bodyCheck = ApproveBody.safeParse(req.body);
  if (!bodyCheck.success) return res.status(400).json({ error: bodyCheck.error.flatten() });
  
  const r = jobs.get(paramCheck.data.id);
  if (!r) return res.status(404).json({ error: "not_found" });
  
  const waiting = r.job.steps.find(s => s.id === r.job.waitingStepId);
  if (!waiting) return res.status(400).json({ error: "no_waiting_step" });
  
  const { selectedFiles, approveAll } = bodyCheck.data;
  
  try {
    // Apply the approved step with selective files if specified
    if (!approveAll && selectedFiles && selectedFiles.length > 0) {
      r.log(`Selective approval: applying ${selectedFiles.length} selected file(s)`);
      await r.applyApproved(waiting, selectedFiles);
    } else {
      r.log("Full approval: applying all staged files");
      await r.applyApproved(waiting);
    }
    
    await r.runTestsForStep(waiting);
    
    // Move to next step
    const idx = r.job.steps.findIndex(s => s.id === waiting.id);
    const next = r.job.steps[idx + 1];
    if (next) {
      await r.executeStep(next); // stage next and pause again
      await persistJob(r); // Persist after each step
      res.json({ 
        ok: true, 
        state: r.job.state, 
        nextWaitingStepId: r.job.waitingStepId,
        currentStep: idx + 1,
        totalSteps: r.job.steps.length,
        appliedFiles: selectedFiles || "all"
      });
    } else {
      r.job.state = "done";
      r.job.waitingStepId = undefined;
      r.log("All steps completed successfully!");
      await persistJob(r); // Persist final state
      res.json({ ok: true, state: "done" });
    }
  } catch (e: any) {
    console.error("Autopilot approve error:", e);
    r.job.state = "error";
    waiting.status = "error";
    waiting.error = e?.message || String(e);
    r.log(`Approval failed: ${waiting.error}`);
    res.status(500).json({ error: waiting.error });
  }
});

autopilotRouter.post("/:id/abort", async (req, res) => {
  const paramCheck = IdParam.safeParse(req.params);
  if (!paramCheck.success) return res.status(400).json({ error: "invalid_id" });
  
  const r = jobs.get(paramCheck.data.id);
  if (!r) return res.status(404).json({ error: "not_found" });
  
  r.job.state = "aborted";
  r.job.waitingStepId = undefined;
  r.log("Job aborted by user.");
  await persistJob(r); // Persist abort state
  res.json({ ok: true });
});

// Cleanup endpoint for development
autopilotRouter.delete("/:id", async (req, res) => {
  const paramCheck = IdParam.safeParse(req.params);
  if (!paramCheck.success) return res.status(400).json({ error: "invalid_id" });
  
  const removed = jobs.delete(paramCheck.data.id);
  res.json({ ok: removed });
});

// Recover job from disk
autopilotRouter.post("/:id/recover", async (req, res) => {
  const paramCheck = IdParam.safeParse(req.params);
  if (!paramCheck.success) return res.status(400).json({ error: "invalid_id" });
  
  const { root } = req.body;
  if (!root) return res.status(400).json({ error: "root_required" });
  
  try {
    const jobData = await loadJob(root, paramCheck.data.id);
    if (!jobData) return res.status(404).json({ error: "job_not_found_on_disk" });
    
    // Recreate runner from persisted data
    const runner = new AutopilotRunner(jobData.root, jobData.provider, jobData.model, jobData.prompt);
    runner.job = jobData; // Restore full state
    jobs.set(runner.job.id, runner);
    
    res.json({ ok: true, job: runner.job });
  } catch (e: any) {
    console.error("Job recovery error:", e);
    res.status(500).json({ error: e?.message || "recovery_failed" });
  }
});

// List all jobs (for debugging)
autopilotRouter.get("/", async (req, res) => {
  const jobList = Array.from(jobs.values()).map(r => ({
    id: r.job.id,
    state: r.job.state,
    prompt: r.job.prompt.slice(0, 100) + (r.job.prompt.length > 100 ? "..." : ""),
    createdAt: r.job.createdAt,
    stepsCount: r.job.steps.length
  }));
  res.json({ jobs: jobList });
});