import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";

// Mock the context indexer to avoid transformers dependency in tests
jest.mock("../src/context/indexer", () => ({
  searchIndex: jest.fn().mockResolvedValue({ matches: [] }),
  packContext: jest.fn().mockReturnValue("")
}));

import { createApp } from "../src/app";

function td() { return fs.mkdtemp(path.join(os.tmpdir(), "kiro-ap-")); }

describe("autopilot (mock)", () => {
  it("plans, stages, approves, applies", async () => {
    const dir = await td();
    await fs.mkdir(path.join(dir, "src"), { recursive: true });
    await fs.writeFile(path.join(dir, "src", "example.ts"), "export function add(a,b){return a+b}");

    const app = createApp();

    // start
    const start = await request(app).post("/autopilot/start").send({
      root: dir,
      prompt: "Improve example types",
      provider: "mock",
      model: "mock-echo"
    });
    expect(start.status).toBe(200);
    const id = start.body.id;
    expect(id).toBeTruthy();

    // status should be awaiting approval & staged
    const st1 = await request(app).get(`/autopilot/${id}/status`);
    expect(st1.status).toBe(200);
    expect(st1.body.state).toBe("awaiting-approval");
    expect(st1.body.steps[0].status).toBe("staged");

    // approve -> applies & tests
    const ap = await request(app).post(`/autopilot/${id}/approve`);
    expect(ap.status).toBe(200);

    const st2 = await request(app).get(`/autopilot/${id}/status`);
    expect(st2.status).toBe(200);
    expect(["running","done","awaiting-approval"]).toContain(st2.body.state);
    expect(["applied","tested","approved","staged","pending"]).toContain(st2.body.steps[0].status);

    // file should be edited
    const newContent = await fs.readFile(path.join(dir, "src", "example.ts"), "utf-8").catch(()=> "");
    expect(newContent.includes("Enhanced")).toBeTruthy();
  }, 30000);

  it("handles abort correctly", async () => {
    const dir = await td();
    await fs.mkdir(path.join(dir, "src"), { recursive: true });
    await fs.writeFile(path.join(dir, "src", "example.ts"), "export function add(a,b){return a+b}");

    const app = createApp();

    // start
    const start = await request(app).post("/autopilot/start").send({
      root: dir,
      prompt: "Improve example types",
      provider: "mock",
      model: "mock-echo"
    });
    expect(start.status).toBe(200);
    const id = start.body.id;

    // abort
    const abort = await request(app).post(`/autopilot/${id}/abort`);
    expect(abort.status).toBe(200);

    // status should be aborted
    const st = await request(app).get(`/autopilot/${id}/status`);
    expect(st.status).toBe(200);
    expect(st.body.state).toBe("aborted");
  }, 15000);

  it("validates input parameters", async () => {
    const app = createApp();

    // missing root
    const noRoot = await request(app).post("/autopilot/start").send({
      prompt: "test"
    });
    expect(noRoot.status).toBe(400);

    // missing prompt
    const noPrompt = await request(app).post("/autopilot/start").send({
      root: "/tmp"
    });
    expect(noPrompt.status).toBe(400);

    // short prompt
    const shortPrompt = await request(app).post("/autopilot/start").send({
      root: "/tmp",
      prompt: "hi"
    });
    expect(shortPrompt.status).toBe(400);
  });

  it("handles non-existent job IDs", async () => {
    const app = createApp();

    const status = await request(app).get("/autopilot/nonexistent/status");
    expect(status.status).toBe(404);

    const approve = await request(app).post("/autopilot/nonexistent/approve");
    expect(approve.status).toBe(404);

    const abort = await request(app).post("/autopilot/nonexistent/abort");
    expect(abort.status).toBe(404);
  });

  it("supports selective approval", async () => {
    const dir = await td();
    await fs.mkdir(path.join(dir, "src"), { recursive: true });
    await fs.writeFile(path.join(dir, "src", "example.ts"), "export function add(a,b){return a+b}");

    const app = createApp();

    // start
    const start = await request(app).post("/autopilot/start").send({
      root: dir,
      prompt: "Improve example types",
      provider: "mock",
      model: "mock-echo"
    });
    expect(start.status).toBe(200);
    const id = start.body.id;

    // selective approve with specific files
    const approve = await request(app).post(`/autopilot/${id}/approve`).send({
      selectedFiles: ["src/example.ts"],
      approveAll: false
    });
    expect(approve.status).toBe(200);
    expect(approve.body.appliedFiles).toEqual(["src/example.ts"]);
  }, 30000);

  it("persists job state to disk", async () => {
    const dir = await td();
    await fs.mkdir(path.join(dir, "src"), { recursive: true });
    await fs.writeFile(path.join(dir, "src", "example.ts"), "export function add(a,b){return a+b}");

    const app = createApp();

    // start
    const start = await request(app).post("/autopilot/start").send({
      root: dir,
      prompt: "Improve example types",
      provider: "mock",
      model: "mock-echo"
    });
    expect(start.status).toBe(200);
    const id = start.body.id;

    // check if job file exists
    const jobFile = path.join(dir, ".kiro", "autopilot", `${id}.json`);
    const jobExists = await fs.access(jobFile).then(() => true).catch(() => false);
    expect(jobExists).toBe(true);

    // verify job content
    const jobData = JSON.parse(await fs.readFile(jobFile, "utf-8"));
    expect(jobData.id).toBe(id);
    expect(jobData.state).toBe("awaiting-approval");
  }, 30000);
});