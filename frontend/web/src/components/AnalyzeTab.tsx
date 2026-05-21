"use client";

import { useState, useEffect } from "react";
import { Box, Typography, Alert } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import HubIcon from "@mui/icons-material/Hub";
import BiotechIcon from "@mui/icons-material/Biotech";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import SendIcon from "@mui/icons-material/Send";
import GppGoodIcon from "@mui/icons-material/GppGood";
import BugReportIcon from "@mui/icons-material/BugReport";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import { analyzeProject, AnalyzeResult } from "@/lib/api";
import ResultsPanel from "./results/ResultsPanel";

// ── Config ────────────────────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  { icon: ManageSearchIcon, label: "Searching knowledge base", sub: "RAG Engine",  color: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe" },
  { icon: HubIcon,          label: "Mapping relationships",    sub: "Graph Brain", color: "#0ea5e9", bg: "#e0f2fe", border: "#bae6fd" },
  { icon: BiotechIcon,      label: "Generating test plan",     sub: "LLM Brain",  color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0" },
];

const RISK_CONFIG: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  P1: { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca", glow: "#ef444430" },
  P2: { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa", glow: "#f9731630" },
  P3: { bg: "#fefce8", text: "#a16207", border: "#fde68a", glow: "#eab30830" },
  P4: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", glow: "#22c55e30" },
};

// ── Pipeline loader (horizontal stepper) ──────────────────────────────────────
function PipelineLoader({ step }: { step: number }) {
  return (
    <Box sx={{
      bgcolor: "white", borderRadius: "20px",
      border: "1px solid #e0e7ff", overflow: "hidden",
      boxShadow: "0 4px 24px rgba(99,102,241,0.08)",
    }}>
      {/* Top gradient header */}
      <Box sx={{
        background: "linear-gradient(135deg, #eef2ff 0%, #e0f2fe 50%, #ecfdf5 100%)",
        px: 4, py: 2.5,
        display: "flex", alignItems: "center", gap: 2,
        borderBottom: "1px solid #e0e7ff",
      }}>
        <Box sx={{
          width: 32, height: 32, borderRadius: "10px",
          background: "linear-gradient(135deg, #4f46e5, #0ea5e9)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(79,70,229,0.3)",
        }}>
          <AutoAwesomeIcon sx={{ fontSize: 16, color: "white",
            animation: "spin 2s linear infinite",
            "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
          }} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
            Running Three-Brain Pipeline
          </Typography>
          <Typography sx={{ fontSize: 11, color: "#64748b", mt: 0.2 }}>
            Analysing your feature across all knowledge layers…
          </Typography>
        </Box>
      </Box>

      {/* Horizontal stepper */}
      <Box sx={{ px: 5, py: 4 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", position: "relative" }}>
          {/* Progress track */}
          <Box sx={{
            position: "absolute", top: 20, left: "calc(16.66% - 2px)", right: "calc(16.66% - 2px)",
            height: 2, bgcolor: "#f1f5f9", borderRadius: 1, zIndex: 0,
          }}>
            <Box sx={{
              height: "100%", borderRadius: 1,
              background: "linear-gradient(90deg, #4f46e5, #0ea5e9)",
              width: step === 0 ? "0%" : step === 1 ? "50%" : "100%",
              transition: "width 0.8s ease",
            }} />
          </Box>

          {PIPELINE_STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <Box key={i} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, position: "relative", zIndex: 1 }}>
                {/* Step circle */}
                <Box sx={{
                  width: 40, height: 40, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.4s",
                  bgcolor: done ? "#10b981" : active ? s.color : "white",
                  border: `2px solid ${done ? "#10b981" : active ? s.color : "#e2e8f0"}`,
                  boxShadow: active ? `0 0 0 6px ${s.color}20, 0 4px 12px ${s.color}30` : "none",
                }}>
                  {done ? (
                    <CheckCircleOutlinedIcon sx={{ fontSize: 20, color: "white" }} />
                  ) : active ? (
                    <Icon sx={{
                      fontSize: 20, color: "white",
                      animation: "pulse 1.2s ease-in-out infinite",
                      "@keyframes pulse": { "0%,100%": { opacity: 0.7, transform: "scale(0.9)" }, "50%": { opacity: 1, transform: "scale(1.1)" } },
                    }} />
                  ) : (
                    <Icon sx={{ fontSize: 20, color: "#cbd5e1" }} />
                  )}
                </Box>

                {/* Label */}
                <Box sx={{ textAlign: "center" }}>
                  <Typography sx={{
                    fontSize: 12, fontWeight: done || active ? 700 : 500,
                    color: done ? "#10b981" : active ? s.color : "#94a3b8",
                    lineHeight: 1.3, transition: "color 0.3s",
                  }}>
                    {s.label}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", mt: 0.5 }}>
                    <Box sx={{
                      px: "8px", py: "2px", borderRadius: "999px",
                      bgcolor: done ? "#ecfdf5" : active ? s.bg : "#f8fafc",
                      border: `1px solid ${done ? "#a7f3d0" : active ? s.border : "#e2e8f0"}`,
                    }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: done ? "#10b981" : active ? s.color : "#94a3b8" }}>
                        {done ? "Done" : active ? s.sub : s.sub}
                      </Typography>
                    </Box>
                    {active && (
                      <Box sx={{ display: "flex", gap: "3px" }}>
                        {[0, 1, 2].map((d) => (
                          <Box key={d} sx={{
                            width: 4, height: 4, borderRadius: "50%", bgcolor: s.color,
                            animation: "bounce 0.8s ease infinite",
                            animationDelay: `${d * 0.18}s`,
                            "@keyframes bounce": { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-4px)" } },
                          }} />
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

// ── Result summary hero ───────────────────────────────────────────────────────
function ResultSummary({ result }: { result: AnalyzeResult }) {
  const rc = RISK_CONFIG[result.overall_risk] ?? { bg: "#f8fafc", text: "#475569", border: "#e2e8f0", glow: "#94a3b830" };
  const complexityColor = result.complexity_level === "complex" ? "#ef4444" :
    result.complexity_level === "moderate" ? "#f59e0b" : "#10b981";

  const stats = [
    { value: result.total_scenarios,                                                              label: "Test Scenarios", icon: AssignmentTurnedInIcon, color: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe" },
    { value: result.test_scenarios?.filter(s => s.risk_level === "high").length ?? 0,             label: "High Risk",      icon: BugReportIcon,          color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
    { value: result.gherkin_test_cases?.length ?? 0,                                              label: "Gherkin Cases",  icon: GppGoodIcon,            color: "#0ea5e9", bg: "#e0f2fe", border: "#bae6fd" },
    { value: result.risk_areas?.length ?? 0,                                                      label: "Risk Areas",     icon: AccountTreeIcon,        color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  ];

  return (
    <Box sx={{
      bgcolor: "white", borderRadius: "20px", overflow: "hidden",
      border: "1px solid #e2e8f0",
      boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      animation: "fadeUp 0.4s ease both",
      "@keyframes fadeUp": { from: { opacity: 0, transform: "translateY(16px)" }, to: { opacity: 1, transform: "translateY(0)" } },
    }}>
      {/* Tri-color top bar */}
      <Box sx={{ height: 4, background: "linear-gradient(90deg, #4f46e5 0%, #0ea5e9 50%, #10b981 100%)" }} />

      {/* Hero header */}
      <Box sx={{ px: 4, pt: 3, pb: 3, borderBottom: "1px solid #f1f5f9" }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 3 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", mb: 0.5 }}>
              Feature Analysed
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
              {result.feature_name ?? result.detected_module}
            </Typography>
            {/* Tags */}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
              {[
                { label: result.detected_module,  bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
                { label: result.detected_priority, bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd" },
                { label: `${result.complexity_level?.toUpperCase()} complexity`, bg: complexityColor + "12", color: complexityColor, border: complexityColor + "35" },
              ].map((t) => t.label && (
                <Box key={t.label} sx={{ px: "10px", py: "3px", borderRadius: "999px", bgcolor: t.bg, border: `1px solid ${t.border}` }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: t.color }}>{t.label}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Risk + time */}
          <Box sx={{ textAlign: "right", flexShrink: 0 }}>
            <Typography sx={{ fontSize: 11, color: "#94a3b8", mb: 1 }}>
              {new Date(result.generated_at).toLocaleTimeString()}
            </Typography>
            <Box sx={{
              px: "16px", py: "8px", borderRadius: "12px",
              bgcolor: rc.bg, border: `1px solid ${rc.border}`,
              boxShadow: `0 0 0 4px ${rc.glow}`,
            }}>
              <Typography sx={{ fontSize: 16, fontWeight: 800, color: rc.text }}>
                {result.overall_risk}
              </Typography>
              <Typography sx={{ fontSize: 10, color: rc.text, opacity: 0.7, fontWeight: 600 }}>RISK LEVEL</Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Stats grid */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
        {stats.map(({ value, label, icon: Icon, color, bg, border }, i) => (
          <Box key={i} sx={{
            px: 3, py: 3, textAlign: "center",
            borderRight: i < 3 ? "1px solid #f1f5f9" : "none",
            "&:hover": { bgcolor: bg },
            transition: "background 0.15s",
          }}>
            <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: "10px", bgcolor: bg, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon sx={{ fontSize: 18, color }} />
              </Box>
            </Box>
            <Typography sx={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {value}
            </Typography>
            <Typography sx={{ fontSize: 11, color: "#94a3b8", mt: 0.5, fontWeight: 500 }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AnalyzeTab({ kbChunks, projectId }: { kbChunks: number; projectId: string }) {
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  useEffect(() => {
    if (!loading) { setPipelineStep(0); return; }
    const timer = setInterval(() => {
      setPipelineStep((s) => (s < PIPELINE_STEPS.length - 1 ? s + 1 : s));
    }, 2800);
    return () => clearInterval(timer);
  }, [loading]);

  const handleAnalyze = async () => {
    if (!story.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await analyzeProject(projectId, story);
      setResult(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const hasContent = story.trim().length > 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

      {/* ── Page title ── */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 22, color: "#0f172a", lineHeight: 1.2 }}>
            Analyze &amp; Generate
          </Typography>
          <Typography sx={{ color: "#64748b", fontSize: 14, mt: 0.5 }}>
            Paste a user story — get a complete QA test plan powered by three AI brains.
          </Typography>
        </Box>
        {/* KB badge */}
        <Box sx={{
          display: "flex", alignItems: "center", gap: 1,
          px: "14px", py: "8px", borderRadius: "999px",
          bgcolor: kbChunks > 0 ? "#ecfdf5" : "#fffbeb",
          border: `1px solid ${kbChunks > 0 ? "#a7f3d0" : "#fde68a"}`,
          flexShrink: 0,
        }}>
          {kbChunks > 0
            ? <CheckCircleOutlinedIcon sx={{ fontSize: 14, color: "#10b981" }} />
            : <WarningAmberIcon sx={{ fontSize: 14, color: "#f59e0b" }} />
          }
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: kbChunks > 0 ? "#065f46" : "#92400e" }}>
            {kbChunks > 0 ? `${kbChunks} KB chunks loaded` : "No KB — LLM inference only"}
          </Typography>
        </Box>
      </Box>

      {/* ── Prompt studio card ── */}
      <Box sx={{
        bgcolor: "white", borderRadius: "20px", overflow: "hidden",
        border: hasContent ? "1.5px solid #a5b4fc" : "1.5px solid #e2e8f0",
        boxShadow: hasContent
          ? "0 0 0 4px rgba(99,102,241,0.08), 0 4px 16px rgba(0,0,0,0.06)"
          : "0 2px 8px rgba(0,0,0,0.04)",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}>
        {/* Card header */}
        <Box sx={{
          px: 3, pt: 2.5, pb: 1.5,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid #f8fafc",
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{
              width: 6, height: 6, borderRadius: "50%",
              bgcolor: hasContent ? "#4f46e5" : "#e2e8f0",
              boxShadow: hasContent ? "0 0 6px #6366f1" : "none",
              transition: "all 0.3s",
            }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.09em" }}>
              User Story / Feature Description
            </Typography>
          </Box>
          {hasContent && (
            <Typography sx={{ fontSize: 11, color: "#a5b4fc", fontFamily: "monospace", fontWeight: 600 }}>
              {story.length} chars
            </Typography>
          )}
        </Box>

        {/* Textarea */}
        <textarea
          rows={8}
          value={story}
          onChange={(e) => setStory(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && hasContent && !loading) handleAnalyze();
          }}
          placeholder={"As a [role], I want to [goal] so that [benefit]…\n\nInclude acceptance criteria, business rules, or any context that helps the AI generate better test coverage."}
          style={{
            width: "100%", display: "block",
            padding: "16px 24px",
            fontSize: 14, lineHeight: 1.75,
            color: "#1e293b",
            background: "transparent",
            border: "none", outline: "none",
            resize: "none",
            fontFamily: "Inter, system-ui, sans-serif",
            boxSizing: "border-box",
          }}
        />

        {/* Input fill bar */}
        <Box sx={{ height: 2, bgcolor: "#f8fafc" }}>
          <Box sx={{
            height: "100%",
            background: "linear-gradient(90deg, #6366f1, #0ea5e9)",
            width: `${Math.min(100, (story.length / 500) * 100)}%`,
            transition: "width 0.3s",
            borderRadius: "0 2px 2px 0",
          }} />
        </Box>

        {/* Toolbar */}
        <Box sx={{
          px: 3, py: 2,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          bgcolor: "#fafbff", borderTop: "1px solid #f1f5f9",
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography sx={{ fontSize: 11, color: "#94a3b8" }}>
              {hasContent ? "⌘ + Enter to run" : "Tip: more detail → better coverage"}
            </Typography>
            {hasContent && (
              <Box sx={{ display: "flex", gap: 0.5 }}>
                {PIPELINE_STEPS.map((s) => (
                  <Box key={s.sub} sx={{
                    width: 5, height: 5, borderRadius: "50%", bgcolor: s.color, opacity: 0.5,
                  }} />
                ))}
              </Box>
            )}
          </Box>

          <Box
            component="button"
            disabled={loading || !hasContent}
            onClick={handleAnalyze}
            sx={{
              display: "flex", alignItems: "center", gap: "8px",
              px: "20px", py: "9px", borderRadius: "12px",
              fontSize: 13.5, fontWeight: 700,
              border: "none", cursor: loading || !hasContent ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              ...(loading
                ? { bgcolor: "#818cf8", color: "white" }
                : hasContent
                ? { bgcolor: "#4f46e5", color: "white", boxShadow: "0 4px 14px rgba(79,70,229,0.35)", "&:hover": { bgcolor: "#4338ca", boxShadow: "0 6px 20px rgba(79,70,229,0.4)" }, "&:active": { transform: "scale(0.97)" } }
                : { bgcolor: "#f1f5f9", color: "#cbd5e1" }
              ),
            }}
          >
            {loading ? (
              <>
                <ElectricBoltIcon sx={{ fontSize: 15, animation: "spin 1s linear infinite", "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } } }} />
                Analysing…
              </>
            ) : (
              <>
                <SendIcon sx={{ fontSize: 14 }} />
                Run QA Analysis
              </>
            )}
          </Box>
        </Box>
      </Box>

      {/* ── Pipeline loader ── */}
      {loading && <PipelineLoader step={pipelineStep} />}

      {/* ── Error ── */}
      {error && (
        <Alert severity="error" sx={{ borderRadius: "14px", border: "1px solid #fecaca", bgcolor: "#fef2f2" }}>
          {error}
        </Alert>
      )}

      {/* ── Results ── */}
      {result && !loading && (
        <Box sx={{
          display: "flex", flexDirection: "column", gap: 3,
          animation: "fadeUp 0.4s ease both",
          "@keyframes fadeUp": { from: { opacity: 0, transform: "translateY(16px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        }}>
          <ResultSummary result={result} />
          <ResultsPanel result={result} />
        </Box>
      )}
    </Box>
  );
}
