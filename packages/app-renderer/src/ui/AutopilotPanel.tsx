import React, { useEffect, useState } from "react";

type Job = {
  id: string; 
  state: string; 
  waitingStepId?: string;
  steps: { 
    id: string; 
    title: string; 
    status: string; 
    rationale?: string;
    test?: { ok: boolean; output: string };
    error?: string;
  }[];
  log: { time: string; msg: string }[];
  prompt: string;
  provider: string;
  model: string;
};

export const AutopilotPanel: React.FC = () => {
  const [root, setRoot] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [job, setJob] = useState<Job | null>(null);
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<"auto" | "anthropic" | "openai" | "mock">("mock");
  const [model, setModel] = useState("claude-sonnet-4");
  const [busy, setBusy] = useState(false);

  useEffect(() => { 
    (async () => setRoot(await window.kirobridge?.workspaceRoot?.() || ""))(); 
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`http://127.0.0.1:4455/autopilot/${jobId}/status`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null);
        if (r) setJob(r);
      } catch (error) {
        console.error("Failed to fetch job status:", error);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [jobId]);

  const start = async () => {
    if (!root || !prompt.trim() || busy) return;
    setBusy(true);
    try {
      const body = { root, prompt, provider, model };
      const r = await fetch("http://127.0.0.1:4455/autopilot/start", {
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(body)
      }).then(r => r.json());
      
      if (r?.id) {
        setJobId(r.id);
        setJob(r.job);
      } else {
        console.error("Failed to start autopilot:", r);
      }
    } catch (error) {
      console.error("Autopilot start error:", error);
    } finally {
      setBusy(false);
    }
  };

  const approve = async (selectedFiles?: string[]) => {
    if (!jobId || busy) return;
    setBusy(true);
    try {
      const body = selectedFiles && selectedFiles.length > 0 
        ? { selectedFiles, approveAll: false }
        : { approveAll: true };
      
      await fetch(`http://127.0.0.1:4455/autopilot/${jobId}/approve`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch (error) {
      console.error("Approve error:", error);
    } finally {
      setBusy(false);
    }
  };

  const abort = async () => {
    if (!jobId || busy) return;
    setBusy(true);
    try {
      await fetch(`http://127.0.0.1:4455/autopilot/${jobId}/abort`, { method: "POST" });
    } catch (error) {
      console.error("Abort error:", error);
    } finally {
      setBusy(false);
    }
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case "done": return "#238636";
      case "error": case "aborted": return "#d1242f";
      case "awaiting-approval": return "#fb8500";
      case "running": case "testing": return "#0969da";
      default: return "var(--muted)";
    }
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case "tested": return "✅";
      case "applied": return "📝";
      case "staged": return "⏳";
      case "error": return "❌";
      case "pending": return "⭕";
      default: return "🔄";
    }
  };

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      height: "100%",
      overflow: "hidden"
    }}>
      {/* Header */}
      <div style={{ 
        padding: "8px 12px", 
        background: "var(--panel)", 
        borderBottom: "1px solid #333",
        flexShrink: 0
      }}>
        <div style={{ fontSize: "12px", marginBottom: "8px" }}>
          <strong>Workspace:</strong> 
          <code style={{ fontSize: "11px", marginLeft: "6px" }}>
            {root || "(open a folder)"}
          </code>
        </div>
        
        {/* Provider/Model Selection */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <select 
            value={provider} 
            onChange={e => setProvider(e.target.value as any)}
            style={{ 
              padding: "4px 6px", fontSize: "11px",
              background: "#0b0f14", border: "1px solid #444",
              color: "var(--text)", borderRadius: "3px"
            }}
          >
            <option value="mock">Mock (Testing)</option>
            <option value="auto">Auto</option>
            <option value="anthropic">Claude</option>
            <option value="openai">OpenAI</option>
          </select>
          <select 
            value={model} 
            onChange={e => setModel(e.target.value)}
            style={{ 
              padding: "4px 6px", fontSize: "11px",
              background: "#0b0f14", border: "1px solid #444",
              color: "var(--text)", borderRadius: "3px"
            }}
          >
            <option value="claude-sonnet-4">Claude Sonnet 4</option>
            <option value="mock-echo">Mock Echo</option>
          </select>
        </div>
        
        {/* Input and Controls */}
        <div style={{ display: "flex", gap: 6 }}>
          <input 
            value={prompt} 
            onChange={e => setPrompt(e.target.value)} 
            placeholder='e.g. "Refactor utils to TypeScript strict, add JSDoc to exported functions"' 
            style={{ 
              flex: 1, 
              padding: "6px 8px", 
              fontSize: "12px",
              background: "#0b0f14",
              border: "1px solid #444",
              color: "var(--text)",
              borderRadius: "3px"
            }}
            onKeyDown={e => e.key === 'Enter' && !busy && start()}
          />
          <button 
            onClick={start} 
            disabled={!root || !prompt.trim() || busy}
            style={{ 
              padding: "6px 12px", 
              fontSize: "11px",
              background: (!root || !prompt.trim() || busy) ? "#666" : "#238636",
              color: "white",
              border: "none",
              borderRadius: "3px",
              cursor: (!root || !prompt.trim() || busy) ? "not-allowed" : "pointer"
            }}
          >
            {busy ? "Starting..." : "Start"}
          </button>
          <button 
            onClick={() => approve()} 
            disabled={!job || job.state !== "awaiting-approval" || busy}
            style={{ 
              padding: "6px 12px", 
              fontSize: "11px",
              background: (!job || job.state !== "awaiting-approval" || busy) ? "#666" : "#fb8500",
              color: "white",
              border: "none",
              borderRadius: "3px",
              cursor: (!job || job.state !== "awaiting-approval" || busy) ? "not-allowed" : "pointer"
            }}
          >
            {busy ? "Approving..." : "Approve All"}
          </button>
          <button 
            onClick={() => {
              // This would integrate with the Diffs panel to get selected files
              // For now, we'll show a placeholder
              const selectedFiles = ["src/example.ts"]; // This should come from Diffs panel
              approve(selectedFiles);
            }} 
            disabled={!job || job.state !== "awaiting-approval" || busy}
            style={{ 
              padding: "6px 12px", 
              fontSize: "11px",
              background: (!job || job.state !== "awaiting-approval" || busy) ? "#666" : "#238636",
              color: "white",
              border: "none",
              borderRadius: "3px",
              cursor: (!job || job.state !== "awaiting-approval" || busy) ? "not-allowed" : "pointer"
            }}
          >
            Approve Selected
          </button>
          <button 
            onClick={abort} 
            disabled={!jobId || busy}
            style={{ 
              padding: "6px 12px", 
              fontSize: "11px",
              background: (!jobId || busy) ? "#666" : "#d1242f",
              color: "white",
              border: "none",
              borderRadius: "3px",
              cursor: (!jobId || busy) ? "not-allowed" : "pointer"
            }}
          >
            Abort
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div style={{ 
        padding: "6px 12px", 
        background: "var(--panel)", 
        borderBottom: "1px solid #333", 
        display: "flex", 
        justifyContent: "space-between",
        alignItems: "center",
        flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>Status:</span>
          <strong style={{ color: getStatusColor(job?.state || "") }}>
            {job?.state || "—"}
          </strong>
        </div>
        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
          {job?.waitingStepId ? `Waiting for approval` : 
           job?.steps ? `${job.steps.filter(s => s.status === "tested").length}/${job.steps.length} steps completed` :
           "No active job"}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ 
        display: "flex", 
        flex: 1,
        minHeight: 0
      }}>
        {/* Steps Panel */}
        <div style={{ 
          width: "50%", 
          overflow: "auto", 
          borderRight: "1px solid #333" 
        }}>
          <div style={{ 
            padding: "8px 12px", 
            fontWeight: 600, 
            fontSize: "12px",
            borderBottom: "1px solid #333",
            background: "var(--panel)"
          }}>
            Steps {job?.steps ? `(${job.steps.length})` : ""}
          </div>
          <div>
            {job?.steps?.map((s, idx) => (
              <div key={s.id} style={{ 
                padding: "8px 12px", 
                borderBottom: "1px solid #333",
                background: s.id === job.waitingStepId ? "rgba(251, 133, 0, 0.1)" : "transparent"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: "14px" }}>{getStepStatusIcon(s.status)}</span>
                  <strong style={{ fontSize: "12px" }}>{idx + 1}. {s.title}</strong>
                </div>
                {s.rationale && (
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: 4 }}>
                    {s.rationale}
                  </div>
                )}
                <div style={{ fontSize: "10px", color: "var(--muted)" }}>
                  Status: {s.status}
                </div>
                {s.test && (
                  <div style={{ 
                    fontSize: "10px", 
                    marginTop: 4,
                    padding: "4px 6px",
                    background: s.test.ok ? "rgba(35, 134, 54, 0.2)" : "rgba(209, 36, 47, 0.2)",
                    borderRadius: "3px"
                  }}>
                    Tests: {s.test.ok ? "✅ Passed" : "❌ Failed"}
                  </div>
                )}
                {s.error && (
                  <div style={{ 
                    fontSize: "10px", 
                    marginTop: 4,
                    padding: "4px 6px",
                    background: "rgba(209, 36, 47, 0.2)",
                    borderRadius: "3px",
                    color: "#f85149"
                  }}>
                    Error: {s.error}
                  </div>
                )}
              </div>
            )) || (
              <div style={{ padding: "12px", color: "var(--muted)", fontSize: "12px" }}>
                No steps yet. Start an autopilot job to see the execution plan.
              </div>
            )}
          </div>
        </div>

        {/* Timeline Panel */}
        <div style={{ 
          width: "50%", 
          overflow: "auto" 
        }}>
          <div style={{ 
            padding: "8px 12px", 
            fontWeight: 600, 
            fontSize: "12px",
            borderBottom: "1px solid #333",
            background: "var(--panel)"
          }}>
            Timeline {job?.log ? `(${job.log.length})` : ""}
          </div>
          <div>
            {job?.log?.map((l, i) => (
              <div key={i} style={{ 
                padding: "6px 12px", 
                borderBottom: "1px dashed #333" 
              }}>
                <div style={{ 
                  color: "var(--muted)", 
                  fontSize: "10px",
                  marginBottom: 2
                }}>
                  {new Date(l.time).toLocaleTimeString()}
                </div>
                <div style={{ fontSize: "11px" }}>{l.msg}</div>
              </div>
            )) || (
              <div style={{ padding: "12px", color: "var(--muted)", fontSize: "12px" }}>
                No events yet.
              </div>
            )}
          </div>
          {job && (
            <div style={{ 
              padding: "12px", 
              fontSize: "11px", 
              fontStyle: "italic",
              color: "var(--muted)",
              borderTop: "1px solid #333",
              background: "var(--panel)"
            }}>
              💡 Review staged patches in the "Diffs" tab, then click Approve to continue.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};