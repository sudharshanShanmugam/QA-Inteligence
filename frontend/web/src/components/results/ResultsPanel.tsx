"use client";

import { useState, useEffect, useRef } from "react";
import {
  Box, Typography, Chip, Alert,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { AnalyzeResult, exportAnalysisExcel } from "@/lib/api";
import ScenarioCard from "./ScenarioCard";
import DownloadIcon from "@mui/icons-material/Download";

// ── Helpers ──────────────────────────────────────────────────────────────────

function FeatureUnderstanding({ raw }: { raw: string }) {
  const text = raw.replace(/\*{1,3}/g, "").replace(/_{1,3}/g, "").trim();
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {sentences.map((sentence, i) => (
        <Typography key={i} sx={{ fontSize: 14, lineHeight: 1.8, color: "text.primary" }}>
          {sentence}
        </Typography>
      ))}
    </Box>
  );
}

function GherkinBlock({ g }: { g: any }) {
  const tags  = g.tags?.join(" ") ?? "";
  const lines: { type: "tag" | "scenario" | "given" | "when" | "then" | "and" | "other"; text: string }[] = [];

  if (tags) tags.split(" ").forEach((t: string) => lines.push({ type: "tag", text: t }));
  if (g.scenario_title) lines.push({ type: "scenario", text: `Scenario: ${g.scenario_title}` });
  (g.given ?? []).forEach((l: string) => lines.push({ type: l.trim().startsWith("And") ? "and" : "given", text: `  ${l}` }));
  (g.when  ?? []).forEach((l: string) => lines.push({ type: l.trim().startsWith("And") ? "and" : "when",  text: `  ${l}` }));
  (g.then  ?? []).forEach((l: string) => lines.push({ type: l.trim().startsWith("And") ? "and" : "then",  text: `  ${l}` }));

  const colorMap: Record<string, string> = {
    tag:      "#818cf8",
    scenario: "#f472b6",
    given:    "#34d399",
    when:     "#60a5fa",
    then:     "#fb923c",
    and:      "#94a3b8",
    other:    "#94a3b8",
  };

  return (
    <Box sx={{
      borderRadius: "12px", overflow: "hidden",
      border: "1px solid", borderColor: "divider",
    }}>
      {g.feature && (
        <Box sx={{
          px: 3, py: 1.5,
          bgcolor: "background.default",
          borderBottom: "1px solid", borderColor: "divider",
        }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: "text.secondary", fontFamily: "monospace", letterSpacing: "0.05em" }}>
            Feature: {g.feature}
          </Typography>
        </Box>
      )}
      <Box sx={{ bgcolor: "background.paper", px: 3, py: 2.5 }}>
        <pre style={{ margin: 0, fontFamily: "ui-monospace, 'JetBrains Mono', 'Fira Code', monospace", fontSize: 12.5, lineHeight: 1.8, overflow: "auto" }}>
          {lines.map((line, i) => (
            <span key={i} style={{ display: "block", color: colorMap[line.type] ?? "#94a3b8" }}>
              {line.text}
            </span>
          ))}
        </pre>
      </Box>
    </Box>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function SectionCard({
  id, num, title, count, badge, children,
}: {
  id: string; num: number; title: string; count?: number;
  badge?: { label: string; color: string; bg: string };
  children: React.ReactNode;
}) {
  return (
    <Box
      id={id}
      sx={{
        bgcolor: "background.paper",
        border: "1px solid", borderColor: "divider",
        borderRadius: "16px",
        overflow: "hidden",
        scrollMarginTop: "80px",
      }}
    >
      {/* Card header */}
      <Box sx={{
        display: "flex", alignItems: "center", gap: 2,
        px: 3, py: 2,
        borderBottom: "1px solid", borderColor: "divider",
        bgcolor: "background.default",
      }}>
        <Box sx={{
          width: 28, height: 28, borderRadius: "8px",
          bgcolor: "primary.main", display: "flex",
          alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: "white" }}>{num}</Typography>
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: 14, color: "text.primary", flex: 1 }}>
          {title}
        </Typography>
        {count !== undefined && (
          <Box sx={{
            px: "10px", py: "3px", borderRadius: "999px",
            bgcolor: "action.selected",
            border: "1px solid", borderColor: "divider",
          }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary" }}>{count}</Typography>
          </Box>
        )}
        {badge && (
          <Box sx={{
            px: "10px", py: "3px", borderRadius: "999px",
            bgcolor: badge.bg, border: `1px solid ${badge.color}40`,
          }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: badge.color }}>{badge.label}</Typography>
          </Box>
        )}
      </Box>
      {/* Card body */}
      <Box sx={{ p: 3 }}>
        {children}
      </Box>
    </Box>
  );
}

// ── TOC ───────────────────────────────────────────────────────────────────────

const TOC_ITEMS = [
  { id: "sec-overview",    label: "Overview",       icon: "01" },
  { id: "sec-modules",     label: "Modules",        icon: "02" },
  { id: "sec-flow",        label: "Event Flow",     icon: "03" },
  { id: "sec-risks",       label: "Risk Areas",     icon: "04" },
  { id: "sec-warnings",    label: "Warnings",       icon: "05" },
  { id: "sec-scenarios",   label: "Test Scenarios", icon: "06" },
  { id: "sec-gherkin",     label: "Gherkin Tests",  icon: "07" },
  { id: "sec-regression",  label: "Regression",     icon: "08" },
  { id: "sec-missing",     label: "Coverage Gaps",  icon: "09" },
  { id: "sec-api",         label: "API Validation", icon: "10" },
];

function TableOfContents({ active }: { active: string }) {
  return (
    <Box sx={{
      position: "sticky", top: 80,
      width: 188, flexShrink: 0,
      display: { xs: "none", lg: "block" },
    }}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.1em", mb: 1.5, px: 1 }}>
        On this page
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
        {TOC_ITEMS.map((item) => {
          const isActive = active === item.id;
          return (
            <Box
              key={item.id}
              component="a"
              href={`#${item.id}`}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              sx={{
                display: "flex", alignItems: "center", gap: 1.5,
                px: 1, py: "6px", borderRadius: "8px",
                textDecoration: "none",
                bgcolor: isActive ? "primary.main" + "18" : "transparent",
                borderLeft: isActive ? "2px solid" : "2px solid transparent",
                borderLeftColor: isActive ? "primary.main" : "transparent",
                transition: "all 0.15s",
                cursor: "pointer",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: isActive ? "primary.main" : "text.disabled", minWidth: 20, fontFamily: "monospace" }}>
                {item.icon}
              </Typography>
              <Typography sx={{ fontSize: 12.5, fontWeight: isActive ? 600 : 400, color: isActive ? "primary.main" : "text.secondary" }}>
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ── Risk badge helpers ────────────────────────────────────────────────────────

const RISK_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  P1: { bg: "#fef2f2", text: "#b91c1c", dot: "#ef4444" },
  P2: { bg: "#fff7ed", text: "#c2410c", dot: "#f97316" },
  P3: { bg: "#fefce8", text: "#a16207", dot: "#eab308" },
  P4: { bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" },
};

const STATUS_CONFIG = {
  existing: { border: "#818cf8", bg: "#eef2ff", label: "✓ Existing Feature", text: "#4338ca" },
  partial:  { border: "#fbbf24", bg: "#fffbeb", label: "⚠ Partially Known",  text: "#92400e" },
  new:      { border: "#34d399", bg: "#ecfdf5", label: "✦ New Feature",       text: "#065f46" },
};

const LAYER_COLORS: Record<string, { bg: string; text: string }> = {
  UI:           { bg: "#ede9fe", text: "#5b21b6" },
  API:          { bg: "#dbeafe", text: "#1d4ed8" },
  DB:           { bg: "#dcfce7", text: "#15803d" },
  Event:        { bg: "#fef9c3", text: "#a16207" },
  Consumer:     { bg: "#fce7f3", text: "#be185d" },
  Notification: { bg: "#e0f2fe", text: "#0369a1" },
};

// ── Main component ────────────────────────────────────────────────────────────

export default function ResultsPanel({ result, projectId }: { result: AnalyzeResult; projectId?: string }) {
  const status = STATUS_CONFIG[result.feature_status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.new;
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [activeSection, setActiveSection] = useState("sec-overview");
  const [exporting, setExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (!projectId || exporting) return;
    setExporting(true);
    try {
      await exportAnalysisExcel(projectId, result);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Intersection observer for TOC highlight
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    TOC_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const filteredScenarios = (result.test_scenarios ?? []).filter((s) => {
    const matchRisk = riskFilter === "all" || s.risk_level === riskFilter;
    const matchSearch = !search.trim() ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase());
    return matchRisk && matchSearch;
  });

  return (
    <Box ref={containerRef} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

      {/* ── Export bar ── */}
      {projectId && (
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Box
            component="button"
            onClick={handleExport}
            disabled={exporting}
            sx={{
              display: "flex", alignItems: "center", gap: "8px",
              px: "18px", py: "9px", borderRadius: "12px",
              border: "1.5px solid", borderColor: "#a7f3d0",
              bgcolor: exporting ? "#ecfdf5" : "#ecfdf5",
              color: "#065f46", fontSize: 13, fontWeight: 700,
              cursor: exporting ? "not-allowed" : "pointer",
              opacity: exporting ? 0.7 : 1,
              transition: "all 0.15s",
              "&:hover": { bgcolor: "#d1fae5", borderColor: "#6ee7b7", boxShadow: "0 2px 8px rgba(16,185,129,0.15)" },
              "&:active": { transform: "scale(0.97)" },
            }}
          >
            <DownloadIcon sx={{ fontSize: 16, color: "#10b981" }} />
            {exporting ? "Exporting…" : "Export to Excel"}
          </Box>
        </Box>
      )}

      <Box sx={{ display: "flex", gap: 4, alignItems: "flex-start" }}>

      {/* ── Left TOC ── */}
      <TableOfContents active={activeSection} />

      {/* ── Right content ── */}
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>

        {/* Feature Banner */}
        <Box sx={{
          display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2,
          p: 2.5,
          bgcolor: "background.paper",
          border: "1px solid", borderColor: "divider",
          borderRadius: "16px",
          borderLeft: "4px solid", borderLeftColor: status.border,
        }}>
          <Box sx={{
            px: "10px", py: "4px", borderRadius: "999px",
            bgcolor: status.bg,
          }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: status.text }}>{status.label}</Typography>
          </Box>
          <Chip
            label={`Complexity: ${result.complexity_level?.toUpperCase() ?? "UNKNOWN"}`}
            size="small"
            sx={{
              fontWeight: 600, fontSize: 11,
              bgcolor: result.complexity_level === "complex" ? "#fef2f2" :
                       result.complexity_level === "moderate" ? "#fffbeb" : "#f0fdf4",
              color: result.complexity_level === "complex" ? "#b91c1c" :
                     result.complexity_level === "moderate" ? "#a16207" : "#15803d",
            }}
          />
          {result.feature_status_reason && (
            <Typography sx={{ fontSize: 13, color: "text.secondary", flex: 1, minWidth: 200 }}>
              {result.feature_status_reason}
            </Typography>
          )}
        </Box>

        {/* Grounding alerts */}
        {result.kb_sparse && (
          <Alert severity="warning" icon={<WarningAmberIcon sx={{ fontSize: 18 }} />}
            sx={{ borderRadius: 2 }}>
            <strong>Sparse knowledge base</strong> — Upload BRD/SRS for grounded test cases.
          </Alert>
        )}
        {result.apis_inferred && (
          <Alert severity="info" icon={<InfoOutlinedIcon sx={{ fontSize: 18 }} />}
            sx={{ borderRadius: 2 }}>
            <strong>APIs inferred</strong> — Upload a Swagger spec to verify estimated endpoints.
          </Alert>
        )}

        {/* 01 Feature Understanding */}
        <SectionCard id="sec-overview" num={1} title="Feature Understanding">
          <FeatureUnderstanding raw={result.feature_understanding ?? ""} />
        </SectionCard>

        {/* 02 Impacted Modules */}
        <SectionCard id="sec-modules" num={2} title="Impacted Modules" count={result.impacted_modules?.length ?? 0}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {result.impacted_modules?.length
              ? result.impacted_modules.map((m, i) => (
                  <Chip key={i} label={m.name ?? m.id} size="small" variant="outlined"
                    sx={{ borderColor: "divider", color: "text.primary", fontSize: 12 }} />
                ))
              : <Typography sx={{ fontSize: 13, color: "text.disabled" }}>No impacted modules identified</Typography>
            }
          </Box>
        </SectionCard>

        {/* 03 Event Flow */}
        {(result.event_flow?.length ?? 0) > 0 && (
          <SectionCard id="sec-flow" num={3} title="End-to-End Event Flow" count={result.event_flow.length}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {result.event_flow.map((step, i) => {
                const lc = LAYER_COLORS[step.layer] ?? { bg: "#f1f5f9", text: "#475569" };
                return (
                  <Box key={i} sx={{ display: "flex", gap: 2.5, alignItems: "flex-start" }}>
                    <Box sx={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      bgcolor: "primary.main" + "18", border: "2px solid",
                      borderColor: "primary.main" + "40",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: "primary.main" }}>
                        {step.step ?? i + 1}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, bgcolor: "background.default", borderRadius: "12px", px: 2.5, py: 2, border: "1px solid", borderColor: "divider" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                        <Box sx={{ px: "8px", py: "2px", borderRadius: "6px", bgcolor: lc.bg }}>
                          <Typography sx={{ fontSize: 10, fontWeight: 700, color: lc.text, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {step.layer}
                          </Typography>
                        </Box>
                        {step.component && (
                          <Typography sx={{ fontSize: 12, color: "text.secondary", fontWeight: 500 }}>
                            {step.component}
                          </Typography>
                        )}
                      </Box>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 500, color: "text.primary", lineHeight: 1.5 }}>
                        {step.action}
                      </Typography>
                      {step.data && (
                        <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.5, fontFamily: "monospace" }}>
                          {step.data}
                        </Typography>
                      )}
                      {step.validation_point && (
                        <Box sx={{ mt: 1.5, display: "flex", gap: 1, alignItems: "flex-start", p: 1.5, bgcolor: "info.main" + "08", borderRadius: "8px", border: "1px solid", borderColor: "info.main" + "20" }}>
                          <Typography sx={{ fontSize: 11, fontWeight: 700, color: "info.main", flexShrink: 0 }}>✓ Verify</Typography>
                          <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.5 }}>{step.validation_point}</Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </SectionCard>
        )}

        {/* 04 Risk Areas */}
        <SectionCard id="sec-risks" num={4} title="Risk Areas" count={result.risk_areas?.length ?? 0}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {result.risk_areas?.length
              ? result.risk_areas.map((r, i) => {
                  const rc = RISK_BADGE[r.priority] ?? { bg: "#f8fafc", text: "#475569", dot: "#94a3b8" };
                  return (
                    <Box key={i} sx={{
                      display: "flex", gap: 3,
                      p: 2.5, borderRadius: "12px",
                      bgcolor: "background.default",
                      border: "1px solid", borderColor: "divider",
                      position: "relative", overflow: "hidden",
                    }}>
                      {/* Priority accent */}
                      <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, bgcolor: rc.dot, borderRadius: "0 0 0 0" }} />
                      <Box sx={{ pl: 0.5, flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                          <Box sx={{ px: "8px", py: "3px", borderRadius: "6px", bgcolor: rc.bg }}>
                            <Typography sx={{ fontSize: 11, fontWeight: 800, color: rc.text }}>{r.priority}</Typography>
                          </Box>
                          <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: "text.primary" }}>{r.feature}</Typography>
                          {r.module && (
                            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>— {r.module}</Typography>
                          )}
                        </Box>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                          {r.reasons?.map((reason, j) => (
                            <Box key={j} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                              <Box sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: rc.dot, mt: "7px", flexShrink: 0 }} />
                              <Typography sx={{ fontSize: 12.5, color: "text.secondary", lineHeight: 1.6 }}>{reason}</Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                      {r.risk_score !== undefined && (
                        <Box sx={{ flexShrink: 0, textAlign: "right" }}>
                          <Typography sx={{ fontSize: 10, color: "text.disabled", mb: 0.25 }}>RISK SCORE</Typography>
                          <Typography sx={{ fontSize: 20, fontWeight: 800, color: rc.text, lineHeight: 1 }}>
                            {r.risk_score.toFixed(1)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  );
                })
              : <Typography sx={{ fontSize: 13, color: "text.disabled" }}>No risk areas identified</Typography>
            }
          </Box>
        </SectionCard>

        {/* 05 Warnings */}
        <SectionCard id="sec-warnings" num={5} title="Heads-Up Warnings" count={result.heads_up_warnings?.length ?? 0}>
          {result.heads_up_warnings?.length
            ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {result.heads_up_warnings.map((w, i) => (
                  <Box key={i} sx={{
                    display: "flex", gap: 2, p: 2,
                    bgcolor: "#fffbeb", borderRadius: "10px",
                    border: "1px solid #fde68a",
                  }}>
                    <Typography sx={{ fontSize: 16, flexShrink: 0 }}>⚠</Typography>
                    <Box>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "#92400e", lineHeight: 1.5 }}>{w.warning}</Typography>
                      {w.recommendation && (
                        <Typography sx={{ fontSize: 12.5, color: "#78350f", mt: 0.5, lineHeight: 1.5 }}>
                          → {w.recommendation}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            )
            : <Typography sx={{ fontSize: 13, color: "text.disabled" }}>No warnings detected</Typography>
          }
        </SectionCard>

        {/* 06 Test Scenarios */}
        <SectionCard id="sec-scenarios" num={6} title="Test Scenarios" count={result.test_scenarios?.length ?? 0}>
          {/* Filter bar */}
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", mb: 2.5, flexWrap: "wrap" }}>
            <Box sx={{
              display: "flex", alignItems: "center", gap: 1,
              flex: 1, minWidth: 200,
              bgcolor: "background.default",
              border: "1px solid", borderColor: "divider",
              borderRadius: "10px", px: 1.5, py: "7px",
              "&:focus-within": { borderColor: "primary.main", bgcolor: "background.paper" },
              transition: "all 0.15s",
            }}>
              <Typography sx={{ fontSize: 13, color: "text.disabled" }}>🔍</Typography>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search scenarios…"
                style={{
                  border: "none", outline: "none", background: "transparent",
                  fontSize: 13, color: "inherit", flex: 1,
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              />
            </Box>
            <Box sx={{ display: "flex", gap: 0.75 }}>
              {(["all", "high", "medium", "low"] as const).map((level) => {
                const colors: Record<string, { active: string; label: string }> = {
                  all:    { active: "#4f46e5", label: "All" },
                  high:   { active: "#ef4444", label: "High" },
                  medium: { active: "#f59e0b", label: "Med" },
                  low:    { active: "#10b981", label: "Low" },
                };
                const c = colors[level];
                const active = riskFilter === level;
                return (
                  <Box key={level} component="button" onClick={() => setRiskFilter(level)} sx={{
                    px: "12px", py: "6px", borderRadius: "8px",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: "1px solid", borderColor: active ? c.active : "divider",
                    bgcolor: active ? c.active + "15" : "background.paper",
                    color: active ? c.active : "text.secondary",
                    transition: "all 0.15s",
                    "&:hover": { borderColor: c.active + "60" },
                  }}>
                    {c.label}
                  </Box>
                );
              })}
            </Box>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {filteredScenarios.length > 0
              ? filteredScenarios.map((s, i) => <ScenarioCard key={i} s={s} />)
              : <Typography sx={{ fontSize: 13, color: "text.disabled" }}>No scenarios match your filter.</Typography>
            }
          </Box>
        </SectionCard>

        {/* 07 Gherkin */}
        <SectionCard id="sec-gherkin" num={7} title="Gherkin Test Cases" count={result.gherkin_test_cases?.length ?? 0}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {result.gherkin_test_cases?.map((g, i) => <GherkinBlock key={i} g={g} />)}
          </Box>
        </SectionCard>

        {/* 08 Regression Suite */}
        <SectionCard id="sec-regression" num={8} title="Regression Suite" count={result.regression_suite?.length ?? 0}>
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            {result.regression_suite?.map((r, i) => (
              <Box key={i} sx={{
                display: "flex", alignItems: "center", gap: 2,
                py: 1.5, px: 1,
                borderBottom: i < (result.regression_suite?.length ?? 0) - 1 ? "1px solid" : "none",
                borderColor: "divider",
                "&:hover": { bgcolor: "action.hover", borderRadius: "8px" },
                transition: "background 0.12s",
              }}>
                <Box sx={{
                  px: "8px", py: "3px", borderRadius: "6px", flexShrink: 0,
                  bgcolor: r.priority === "MUST-RUN" ? "#fef2f2" : "background.default",
                }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 800, color: r.priority === "MUST-RUN" ? "#b91c1c" : "text.secondary" }}>
                    {r.priority}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 13.5, color: "text.primary", flex: 1 }}>{r.test_case_name}</Typography>
                {r.reason && (
                  <Typography sx={{ fontSize: 12, color: "text.disabled", maxWidth: 240, textAlign: "right" }}>{r.reason}</Typography>
                )}
              </Box>
            ))}
          </Box>
        </SectionCard>

        {/* 09 Missing Coverage */}
        <SectionCard id="sec-missing" num={9} title="Coverage Gaps" count={result.missing_coverage?.length ?? 0}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {result.missing_coverage?.length
              ? result.missing_coverage.map((g, i) => (
                  <Box key={i} sx={{
                    p: 2.5, borderRadius: "10px",
                    bgcolor: "background.default",
                    border: "1px solid", borderColor: "divider",
                  }}>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "text.primary", mb: g.recommendation ? 0.5 : 0 }}>
                      {g.area ?? g.description}
                    </Typography>
                    {g.recommendation && (
                      <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>→ {g.recommendation}</Typography>
                    )}
                  </Box>
                ))
              : <Typography sx={{ fontSize: 13, color: "text.disabled" }}>No coverage gaps identified</Typography>
            }
          </Box>
        </SectionCard>

        {/* 10 API & Event Validation */}
        <SectionCard id="sec-api" num={10} title="API & Event Validation" count={result.api_event_validation?.length ?? 0}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {result.api_event_validation?.map((api, i) => (
              <Box key={i} sx={{
                p: 2.5, borderRadius: "12px",
                bgcolor: "background.default",
                border: "1px solid", borderColor: "divider",
              }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                  <Box sx={{ px: "8px", py: "3px", borderRadius: "6px", bgcolor: "#dbeafe" }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#1d4ed8", fontFamily: "monospace" }}>
                      {api.method}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 13, fontFamily: "monospace", color: "text.primary", fontWeight: 500 }}>
                    {api.endpoint}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                  {api.validations?.map((v, j) => (
                    <Box key={j} sx={{ display: "flex", gap: 1.5 }}>
                      <Box sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: "text.disabled", mt: "8px", flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 12.5, color: "text.secondary", lineHeight: 1.6 }}>{v}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </SectionCard>

      </Box>
      </Box>
    </Box>
  );
}
