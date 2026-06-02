"use client";

import React, { useState, useEffect, useRef } from "react";
import { Box, Typography, Alert } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutlined";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import HistoryIcon from "@mui/icons-material/History";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
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
import HelpOutlineIcon from "@mui/icons-material/HelpOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import {
  analyzeProject, clarifyProject, ClarifyQuestion, AnalyzeResult,
  getProjectAnalyses, deleteProjectAnalysis, clearProjectAnalyses,
  StoredAnalysis,
} from "@/lib/api";
import ResultsPanel from "./results/ResultsPanel";
import ComparePanel from "./results/ComparePanel";

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
      bgcolor: "background.paper", borderRadius: "20px",
      border: "1px solid", borderColor: "primary.main" + "30", overflow: "hidden",
      boxShadow: "0 4px 24px rgba(99,102,241,0.08)",
    }}>
      {/* Top gradient header */}
      <Box sx={{
        background: "linear-gradient(135deg, #eef2ff 0%, #e0f2fe 50%, #ecfdf5 100%)",
        px: 4, py: 2.5,
        display: "flex", alignItems: "center", gap: 2,
        borderBottom: "1px solid", borderBottomColor: "primary.main" + "20",
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
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: "text.primary" }}>
            Running Three-Brain Pipeline
          </Typography>
          <Typography sx={{ fontSize: 11, color: "text.secondary", mt: 0.2 }}>
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
            height: 2, bgcolor: "divider", borderRadius: 1, zIndex: 0,
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
                  bgcolor: done ? "#10b981" : active ? s.color : "background.default",
                  border: `2px solid ${done ? "#10b981" : active ? s.color : ""}`,
                  borderColor: done ? "#10b981" : active ? s.color : "divider",
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
                    <Icon sx={{ fontSize: 20, color: "text.disabled" }} />
                  )}
                </Box>

                {/* Label */}
                <Box sx={{ textAlign: "center" }}>
                  <Typography sx={{
                    fontSize: 12, fontWeight: done || active ? 700 : 500,
                    color: done ? "#10b981" : active ? s.color : "text.disabled",
                    lineHeight: 1.3, transition: "color 0.3s",
                  }}>
                    {s.label}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", mt: 0.5 }}>
                    <Box sx={{
                      px: "8px", py: "2px", borderRadius: "999px",
                      bgcolor: done ? "#ecfdf5" : active ? s.bg : "background.default",
                      border: `1px solid ${done ? "#a7f3d0" : active ? s.border : ""}`,
                      borderColor: done ? "#a7f3d0" : active ? s.border : "divider",
                    }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: done ? "#10b981" : active ? s.color : "text.disabled" }}>
                        {done ? "Done" : s.sub}
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
      bgcolor: "background.paper", borderRadius: "20px", overflow: "hidden",
      border: "1px solid", borderColor: "divider",
      boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      animation: "fadeUp 0.4s ease both",
      "@keyframes fadeUp": { from: { opacity: 0, transform: "translateY(16px)" }, to: { opacity: 1, transform: "translateY(0)" } },
    }}>
      {/* Tri-color top bar */}
      <Box sx={{ height: 4, background: "linear-gradient(90deg, #4f46e5 0%, #0ea5e9 50%, #10b981 100%)" }} />

      {/* Hero header */}
      <Box sx={{ px: 4, pt: 3, pb: 3, borderBottom: "1px solid", borderBottomColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 3 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.1em", mb: 0.5 }}>
              Feature Analysed
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: "text.primary", lineHeight: 1.2 }}>
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
            <Typography sx={{ fontSize: 11, color: "text.disabled", mb: 1 }}>
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
            borderRight: i < 3 ? "1px solid" : "none",
            borderRightColor: "divider",
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
            <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.5, fontWeight: 500 }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Clarification card ────────────────────────────────────────────────────────
function ClarificationCard({
  questions,
  answers,
  onChange,
  onSubmit,
  onSkip,
  submitting,
}: {
  questions: ClarifyQuestion[];
  answers: Record<string, string>;
  onChange: (id: string, value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  submitting: boolean;
}) {
  const answeredCount = questions.filter((q) => answers[q.id]?.trim()).length;

  return (
    <Box sx={{
      bgcolor: "background.paper", borderRadius: "20px", overflow: "hidden",
      border: "1.5px solid", borderColor: "primary.main" + "40",
      boxShadow: "0 0 0 4px rgba(99,102,241,0.06), 0 4px 24px rgba(0,0,0,0.06)",
      animation: "fadeUp 0.35s ease both",
      "@keyframes fadeUp": { from: { opacity: 0, transform: "translateY(12px)" }, to: { opacity: 1, transform: "translateY(0)" } },
    }}>
      {/* Header */}
      <Box sx={{
        px: 4, py: 2.5,
        background: "linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)",
        borderBottom: "1px solid", borderBottomColor: "primary.main" + "20",
        display: "flex", alignItems: "center", gap: 2,
      }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: "11px",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
          flexShrink: 0,
        }}>
          <HelpOutlineIcon sx={{ fontSize: 18, color: "white" }} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: "text.primary" }}>
            A few quick questions
          </Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.3 }}>
            Answering these helps generate more accurate test cases — skip any you don&apos;t know.
          </Typography>
        </Box>
        <Box sx={{
          ml: "auto", px: "12px", py: "4px", borderRadius: "999px",
          bgcolor: "primary.main" + "12", border: "1px solid", borderColor: "primary.main" + "30", flexShrink: 0,
        }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: "primary.main" }}>
            {answeredCount}/{questions.length} answered
          </Typography>
        </Box>
      </Box>

      {/* Questions */}
      <Box sx={{ px: 4, py: 3, display: "flex", flexDirection: "column", gap: 3 }}>
        {questions.map((q, i) => (
          <Box key={q.id}>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 1 }}>
              <Box sx={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                bgcolor: answers[q.id]?.trim() ? "primary.main" : "background.default",
                border: "1.5px solid",
                borderColor: answers[q.id]?.trim() ? "primary.main" : "divider",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s", mt: "1px",
              }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: answers[q.id]?.trim() ? "white" : "text.disabled" }}>
                  {i + 1}
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "text.primary", lineHeight: 1.5 }}>
                  {q.question}
                </Typography>
                {q.hint && (
                  <Typography sx={{ fontSize: 11.5, color: "text.disabled", mt: 0.3 }}>
                    e.g. {q.hint}
                  </Typography>
                )}
              </Box>
            </Box>
            <Box sx={{ ml: "34px" }}>
              <Box
                component="textarea"
                rows={2}
                value={answers[q.id] ?? ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(q.id, e.target.value)}
                placeholder="Type your answer here… (optional)"
                sx={{
                  width: "100%",
                  p: "10px 14px",
                  fontSize: 13.5,
                  lineHeight: 1.65,
                  color: "text.primary",
                  bgcolor: answers[q.id]?.trim() ? "background.paper" : "background.default",
                  border: "1.5px solid",
                  borderColor: answers[q.id]?.trim() ? "primary.main" + "60" : "divider",
                  borderRadius: "12px",
                  outline: "none",
                  resize: "none",
                  fontFamily: "Inter, system-ui, sans-serif",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s, background-color 0.2s",
                  display: "block",
                  "&:focus": {
                    borderColor: "primary.main" + "80",
                    bgcolor: "background.paper",
                  },
                }}
              />
            </Box>
          </Box>
        ))}
      </Box>

      {/* Actions */}
      <Box sx={{
        px: 4, py: 2.5,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        bgcolor: "background.default", borderTop: "1px solid", borderTopColor: "divider",
      }}>
        <Box
          component="button"
          onClick={onSkip}
          disabled={submitting}
          sx={{
            display: "flex", alignItems: "center", gap: "6px",
            px: "16px", py: "8px", borderRadius: "10px",
            border: "1px solid", borderColor: "divider",
            bgcolor: "background.paper",
            color: "text.disabled", fontSize: 12.5, fontWeight: 600,
            cursor: "pointer",
            "&:hover": { color: "text.secondary", borderColor: "text.disabled" },
          }}
        >
          <SkipNextIcon sx={{ fontSize: 15 }} />
          Skip — generate without answers
        </Box>

        <Box
          component="button"
          onClick={onSubmit}
          disabled={submitting}
          sx={{
            display: "flex", alignItems: "center", gap: "8px",
            px: "22px", py: "10px", borderRadius: "12px",
            border: "none", cursor: submitting ? "not-allowed" : "pointer",
            fontSize: 13.5, fontWeight: 700,
            bgcolor: submitting ? "#818cf8" : "#4f46e5",
            color: "white",
            boxShadow: "0 4px 14px rgba(79,70,229,0.3)",
            transition: "all 0.2s",
            "&:hover": { bgcolor: "#4338ca", boxShadow: "0 6px 20px rgba(79,70,229,0.4)" },
            "&:active": { transform: "scale(0.97)" },
          }}
        >
          {submitting ? (
            <><ElectricBoltIcon sx={{ fontSize: 15, animation: "spin 1s linear infinite", "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } } }} />Generating…</>
          ) : (
            <><ArrowForwardIcon sx={{ fontSize: 15 }} />Generate Test Plan</>
          )}
        </Box>
      </Box>
    </Box>
  );
}

type Phase = "input" | "clarifying" | "analyzing" | "done";

// HistoryEntry mirrors StoredAnalysis but keeps timestamp as Date for display
type HistoryEntry = {
  id: string;
  story: string;
  result: AnalyzeResult;
  timestamp: Date;
};

function storedToEntry(s: StoredAnalysis): HistoryEntry {
  return { id: s.id, story: s.story, result: s.result, timestamp: new Date(s.timestamp) };
}

function HistorySection({ projectId, history, setHistory, expandedHistoryId, setExpandedHistoryId, pageMode = false }: {
  projectId: string;
  history: HistoryEntry[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>;
  expandedHistoryId: string | null;
  setExpandedHistoryId: React.Dispatch<React.SetStateAction<string | null>>;
  pageMode?: boolean;
}) {
  const handleClearAll = async () => {
    try {
      await clearProjectAnalyses(projectId);
      setHistory([]);
      setExpandedHistoryId(null);
    } catch { /* silently ignore */ }
  };

  const handleDeleteOne = async (id: string) => {
    try {
      await deleteProjectAnalysis(projectId, id);
      setHistory((prev) => prev.filter((e) => e.id !== id));
      if (expandedHistoryId === id) setExpandedHistoryId(null);
    } catch { /* silently ignore */ }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {pageMode && (
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 22, color: "text.primary", lineHeight: 1.2 }}>
            Analysis History
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: 14, mt: 0.5 }}>
            All test plans generated for this project — persisted until you delete them.
          </Typography>
        </Box>
      )}

      <Box sx={{ mt: pageMode ? 0 : 1 }}>
        {/* Section header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          {!pageMode && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ width: 4, height: 20, borderRadius: 99, bgcolor: "primary.main" }} />
              <HistoryIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: "text.primary" }}>Analysis History</Typography>
              <Box sx={{ px: "10px", py: "2px", borderRadius: 99, bgcolor: "primary.main" + "12", border: "1px solid", borderColor: "primary.main" + "30" }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "primary.main" }}>{history.length}</Typography>
              </Box>
            </Box>
          )}
          {pageMode && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ px: "10px", py: "2px", borderRadius: 99, bgcolor: "primary.main" + "12", border: "1px solid", borderColor: "primary.main" + "30" }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "primary.main" }}>{history.length} {history.length === 1 ? "run" : "runs"}</Typography>
              </Box>
            </Box>
          )}
          {history.length > 0 && (
            <Box
              component="button"
              onClick={handleClearAll}
              sx={{
                display: "flex", alignItems: "center", gap: "5px",
                px: "10px", py: "5px", borderRadius: "8px",
                border: "1px solid", borderColor: "divider",
                bgcolor: "background.paper",
                color: "text.secondary", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                "&:hover": { color: "#ef4444", borderColor: "#fecaca", bgcolor: "#fef2f2" },
              }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 13 }} />
              Delete all
            </Box>
          )}
        </Box>

        {/* Empty state */}
        {history.length === 0 && (
          <Box sx={{
            py: pageMode ? 8 : 4, borderRadius: "16px",
            bgcolor: "background.default",
            border: "1.5px dashed", borderColor: "divider",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
          }}>
            <HistoryIcon sx={{ fontSize: pageMode ? 40 : 28, color: "text.disabled" }} />
            <Typography sx={{ fontSize: 12, color: "text.disabled", fontWeight: 500 }}>
              {pageMode
                ? "No analyses yet — go to Analyze & Generate to run your first test plan"
                : "No analyses yet — run your first test plan above"}
            </Typography>
          </Box>
        )}

        {/* Entries */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {history.map((entry, idx) => {
            const rc = RISK_CONFIG[entry.result.overall_risk] ?? { bg: "#f8fafc", text: "#475569", border: "#e2e8f0", glow: "" };
            const isExpanded = expandedHistoryId === entry.id;
            const isLatest = idx === 0;
            return (
              <Box key={entry.id} sx={{
                bgcolor: "background.paper", borderRadius: "16px",
                border: "1px solid", borderColor: isLatest ? "primary.main" + "40" : "divider",
                overflow: "hidden",
                boxShadow: isLatest ? "0 2px 12px rgba(99,102,241,0.08)" : "none",
                animation: idx === 0 ? "fadeUp 0.3s ease both" : "none",
                "@keyframes fadeUp": { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
              }}>
                {/* Row header */}
                <Box sx={{
                  px: 2.5, py: 1.75,
                  display: "flex", alignItems: "center", gap: 2,
                }}>
                  {/* Expand toggle — left side */}
                  <Box
                    component="button"
                    onClick={() => setExpandedHistoryId(isExpanded ? null : entry.id)}
                    sx={{
                      flex: 1, textAlign: "left", cursor: "pointer",
                      border: "none", bgcolor: "transparent",
                      display: "flex", alignItems: "center", gap: 2,
                      p: 0,
                    }}
                  >
                    {/* Run number */}
                    <Box sx={{
                      width: 28, height: 28, borderRadius: "8px", flexShrink: 0,
                      bgcolor: isLatest ? "primary.main" + "12" : "background.default",
                      border: "1px solid", borderColor: isLatest ? "primary.main" + "30" : "divider",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: isLatest ? "primary.main" : "text.disabled" }}>
                        #{history.length - idx}
                      </Typography>
                    </Box>

                    {/* Feature name + story snippet */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.3 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 13, color: "text.primary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
                          {entry.result.feature_name ?? entry.result.detected_module}
                        </Typography>
                        {isLatest && (
                          <Box sx={{ px: "8px", py: "1px", borderRadius: 99, bgcolor: "primary.main" + "12", border: "1px solid", borderColor: "primary.main" + "30", flexShrink: 0 }}>
                            <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: "primary.main" }}>Latest</Typography>
                          </Box>
                        )}
                      </Box>
                      <Typography sx={{ fontSize: 11.5, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.story.length > 110 ? entry.story.slice(0, 110) + "…" : entry.story}
                      </Typography>
                    </Box>

                    {/* Stats */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                      <Box sx={{ textAlign: "center" }}>
                        <Typography sx={{ fontSize: 16, fontWeight: 800, color: "primary.main", lineHeight: 1 }}>{entry.result.total_scenarios}</Typography>
                        <Typography sx={{ fontSize: 9.5, color: "text.disabled" }}>scenarios</Typography>
                      </Box>
                      <Box sx={{ textAlign: "center" }}>
                        <Typography sx={{ fontSize: 16, fontWeight: 800, color: "secondary.main", lineHeight: 1 }}>{entry.result.gherkin_test_cases?.length ?? 0}</Typography>
                        <Typography sx={{ fontSize: 9.5, color: "text.disabled" }}>gherkin</Typography>
                      </Box>
                      <Box sx={{ px: "10px", py: "4px", borderRadius: "8px", bgcolor: rc.bg, border: `1px solid ${rc.border}` }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: rc.text }}>{entry.result.overall_risk}</Typography>
                      </Box>
                      <Box sx={{ textAlign: "right", minWidth: 56 }}>
                        <Typography sx={{ fontSize: 10.5, color: "text.secondary" }}>
                          {entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Typography>
                        <Typography sx={{ fontSize: 9.5, color: "text.disabled" }}>
                          {entry.timestamp.toLocaleDateString([], { month: "short", day: "numeric" })}
                        </Typography>
                      </Box>
                      {isExpanded
                        ? <ExpandLessIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                        : <ExpandMoreIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                      }
                    </Box>
                  </Box>

                  {/* Delete button — separate from expand toggle */}
                  <Box
                    component="button"
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDeleteOne(entry.id); }}
                    title="Delete this analysis"
                    sx={{
                      width: 28, height: 28, borderRadius: "8px", border: "1px solid",
                      borderColor: "divider", bgcolor: "background.default",
                      color: "text.disabled", cursor: "pointer", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s",
                      "&:hover": { color: "#ef4444", borderColor: "#fecaca", bgcolor: "#fef2f2" },
                    }}
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 13 }} />
                  </Box>
                </Box>

                {/* Expanded: full story + result panels */}
                {isExpanded && (
                  <Box sx={{ borderTop: "1px solid", borderTopColor: "divider" }}>
                    <Box sx={{ px: 2.5, pt: 2, pb: 1.5, bgcolor: "background.default" }}>
                      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.75 }}>
                        User Story
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "text.secondary", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                        {entry.story}
                      </Typography>
                    </Box>
                    <Box sx={{ px: 2.5, pb: 2.5, pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                      <ResultSummary result={entry.result} />
                      <ResultsPanel result={entry.result} projectId={projectId} />
                    </Box>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

export default function AnalyzeTab({ kbChunks, projectId, onAnalyzeComplete, onAnalysisDone, historyOnly = false }: { kbChunks: number; projectId: string; onAnalyzeComplete?: () => void; onAnalysisDone?: (context: string) => void; historyOnly?: boolean }) {
  const [story, setStory] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [pipelineStep, setPipelineStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [baselineResult, setBaselineResult] = useState<AnalyzeResult | null>(null);
  const [clarifyFailed, setClarifyFailed] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const storyRef = useRef<HTMLTextAreaElement>(null);

  const loading = phase === "analyzing";

  // Load persisted history from backend on mount
  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    getProjectAnalyses(projectId)
      .then(({ analyses }) => {
        if (!cancelled) setHistory(analyses.map(storedToEntry));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (phase !== "analyzing") { setPipelineStep(0); return; }
    const timer = setInterval(() => {
      setPipelineStep((s) => (s < PIPELINE_STEPS.length - 1 ? s + 1 : s));
    }, 2800);
    return () => clearInterval(timer);
  }, [phase]);

  const handleFirstSubmit = async () => {
    if (!story.trim()) return;
    setError(null);
    setResult(null);
    setClarifyFailed(false);
    setPhase("clarifying");
    try {
      const { questions: qs } = await clarifyProject(projectId, story);
      if (qs.length === 0) {
        await runAnalysis({});
      } else {
        setQuestions(qs);
        setAnswers({});
      }
    } catch {
      setClarifyFailed(true);
      await runAnalysis({});
    }
  };

  const runAnalysis = async (ans: Record<string, string>) => {
    setPhase("analyzing");
    try {
      const res = await analyzeProject(projectId, story, Object.keys(ans).length ? ans : undefined);
      setResult(res);
      setPhase("done");
      // Use the backend-assigned history ID so frontend and DB stay in sync
      const historyId = (res as any)._history_id ?? Date.now().toString();
      setHistory((prev) => [{ id: historyId, story, result: res, timestamp: new Date() }, ...prev]);
      onAnalyzeComplete?.();
      onAnalysisDone?.(`Feature: ${res.feature_name}\nModule: ${res.detected_module}\nRisk: ${res.overall_risk}\nComplexity: ${res.complexity_level}\n\n${res.feature_understanding ?? ""}`);
    } catch (e: any) {
      setError(e.message);
      setPhase("input");
    }
  };

  // suppress unused var warning
  void loading;
  void historyLoading;

  const handleNewAnalysis = () => {
    setStory("");
    setPhase("input");
    setResult(null);
    setError(null);
    setQuestions([]);
    setAnswers({});
    setClarifyFailed(false);
    setTimeout(() => storyRef.current?.focus(), 50);
  };

  const isActive = phase !== "input" || story.trim().length > 0 || result !== null;
  const hasContent = story.trim().length > 0;

  if (historyOnly) {
    return (
      <HistorySection
        projectId={projectId}
        history={history}
        setHistory={setHistory}
        expandedHistoryId={expandedHistoryId}
        setExpandedHistoryId={setExpandedHistoryId}
        pageMode
      />
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

      {/* ── Page title ── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 22, color: "text.primary", lineHeight: 1.2 }}>
            Analyze &amp; Generate
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: 14, mt: 0.5 }}>
            Paste a user story — get a complete QA test plan powered by three AI brains.
          </Typography>
        </Box>

        {/* Right side controls */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0, mt: 0.5 }}>

          {/* ── New Analysis button ── */}
          <Box
            component="button"
            onClick={handleNewAnalysis}
            title="Clear and start a new analysis"
            sx={{
              display: "flex", alignItems: "center", gap: "7px",
              px: "16px", py: "9px", borderRadius: "12px",
              border: "1.5px solid",
              borderColor: isActive ? "primary.main" + "50" : "divider",
              bgcolor: isActive ? "primary.main" + "08" : "background.paper",
              color: isActive ? "primary.main" : "text.disabled",
              fontSize: 13, fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
              "&:hover": {
                bgcolor: "primary.main" + "12",
                borderColor: "primary.main" + "80",
                color: "primary.main",
                boxShadow: "0 2px 10px rgba(99,102,241,0.15)",
              },
              "&:active": { transform: "scale(0.97)" },
            }}
          >
            <AddCircleOutlineIcon sx={{ fontSize: 16 }} />
            New Analysis
          </Box>

        </Box>
      </Box>

      {/* ── Prompt studio card ── */}
      <Box sx={{
        bgcolor: "background.paper", borderRadius: "20px", overflow: "hidden",
        border: "1.5px solid",
        borderColor: hasContent ? "primary.main" + "60" : "divider",
        boxShadow: hasContent
          ? "0 0 0 4px rgba(99,102,241,0.08), 0 4px 16px rgba(0,0,0,0.06)"
          : "0 2px 8px rgba(0,0,0,0.04)",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}>
        {/* Card header */}
        <Box sx={{
          px: 3, pt: 2.5, pb: 1.5,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid", borderBottomColor: "divider",
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{
              width: 6, height: 6, borderRadius: "50%",
              bgcolor: hasContent ? "primary.main" : "divider",
              boxShadow: hasContent ? "0 0 6px #6366f1" : "none",
              transition: "all 0.3s",
            }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.09em" }}>
              User Story / Feature Description
            </Typography>
          </Box>
          {hasContent && (
            <Typography sx={{ fontSize: 11, color: "primary.main", fontFamily: "monospace", fontWeight: 600, opacity: 0.7 }}>
              {story.length} chars
            </Typography>
          )}
        </Box>

        {/* Textarea — Box component for theme-aware color */}
        <Box
          ref={storyRef}
          component="textarea"
          rows={8}
          value={story}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setStory(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && hasContent && phase === "input") handleFirstSubmit();
          }}
          placeholder={"As a [role], I want to [goal] so that [benefit]…\n\nInclude acceptance criteria, business rules, or any context that helps the AI generate better test coverage."}
          sx={{
            width: "100%", display: "block",
            p: "16px 24px",
            fontSize: 14, lineHeight: 1.75,
            color: "text.primary",
            bgcolor: "transparent",
            border: "none", outline: "none",
            resize: "none",
            fontFamily: "Inter, system-ui, sans-serif",
            boxSizing: "border-box",
            "::placeholder": { color: "text.disabled" },
          }}
        />

        {/* Input fill bar */}
        <Box sx={{ height: 2, bgcolor: "divider" }}>
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
          bgcolor: "background.default", borderTop: "1px solid", borderTopColor: "divider",
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography sx={{ fontSize: 11, color: "text.disabled" }}>
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
            disabled={phase !== "input" || !hasContent}
            onClick={handleFirstSubmit}
            sx={{
              display: "flex", alignItems: "center", gap: "8px",
              px: "20px", py: "9px", borderRadius: "12px",
              fontSize: 13.5, fontWeight: 700,
              border: "none", cursor: (phase !== "input" || !hasContent) ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              ...(phase === "clarifying" && questions.length === 0
                ? { bgcolor: "#818cf8", color: "white" }
                : hasContent && phase === "input"
                ? { bgcolor: "#4f46e5", color: "white", boxShadow: "0 4px 14px rgba(79,70,229,0.35)", "&:hover": { bgcolor: "#4338ca", boxShadow: "0 6px 20px rgba(79,70,229,0.4)" }, "&:active": { transform: "scale(0.97)" } }
                : { bgcolor: "background.default", color: "text.disabled", border: "1px solid", borderColor: "divider" }
              ),
            }}
          >
            {phase === "clarifying" && questions.length === 0 ? (
              <>
                <ElectricBoltIcon sx={{ fontSize: 15, animation: "spin 1s linear infinite", "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } } }} />
                Checking…
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

      {/* ── Clarify failed notice ── */}
      {clarifyFailed && (
        <Alert severity="warning" sx={{ borderRadius: "14px", border: "1px solid #fde68a", bgcolor: "#fffbeb" }}>
          Couldn&apos;t reach the clarification service — running analysis with your story as-is.
        </Alert>
      )}

      {/* ── Clarification card ── */}
      {phase === "clarifying" && questions.length > 0 && (
        <ClarificationCard
          questions={questions}
          answers={answers}
          onChange={(id, val) => setAnswers((prev) => ({ ...prev, [id]: val }))}
          onSubmit={() => runAnalysis(answers)}
          onSkip={() => runAnalysis({})}
          submitting={false}
        />
      )}

      {/* ── Pipeline loader ── */}
      {phase === "analyzing" && <PipelineLoader step={pipelineStep} />}

      {/* ── Error ── */}
      {error && (
        <Alert severity="error" sx={{ borderRadius: "14px", border: "1px solid #fecaca", bgcolor: "#fef2f2" }}>
          {error}
        </Alert>
      )}

      {/* ── Results ── */}
      {result && phase === "done" && (
        <Box sx={{
          display: "flex", flexDirection: "column", gap: 3,
          animation: "fadeUp 0.4s ease both",
          "@keyframes fadeUp": { from: { opacity: 0, transform: "translateY(16px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        }}>
          {baselineResult && <ComparePanel baseline={baselineResult} current={result} />}
          <ResultSummary result={result} />
          <ResultsPanel result={result} projectId={projectId} />
          {/* Action buttons */}
          <Box sx={{ display: "flex", justifyContent: "center", gap: 2, pt: 1 }}>
            <Box
              component="button"
              onClick={() => setBaselineResult(result)}
              sx={{
                display: "flex", alignItems: "center", gap: 1,
                px: "20px", py: "10px", borderRadius: "12px",
                border: "1.5px solid", borderColor: "divider",
                bgcolor: "background.paper",
                color: "text.secondary", fontSize: 13.5, fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s",
                "&:hover": { bgcolor: "background.default", borderColor: "text.disabled" },
              }}
            >
              <CompareArrowsIcon sx={{ fontSize: 15 }} />
              {baselineResult ? "Update Baseline" : "Save as Baseline"}
            </Box>
            <Box
              component="button"
              onClick={() => {
                setResult(null);
                setPhase("input");
                setTimeout(() => storyRef.current?.focus(), 50);
              }}
              sx={{
                display: "flex", alignItems: "center", gap: 1,
                px: "20px", py: "10px", borderRadius: "12px",
                border: "1.5px solid", borderColor: "primary.main" + "40",
                bgcolor: "background.paper",
                color: "primary.main", fontSize: 13.5, fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s",
                "&:hover": { bgcolor: "primary.main" + "08", borderColor: "primary.main" + "70", boxShadow: "0 2px 8px rgba(99,102,241,0.12)" },
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 15 }} />
              Re-run Analysis
            </Box>
          </Box>
        </Box>
      )}

    </Box>
  );
}
