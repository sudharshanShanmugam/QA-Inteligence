"use client";

import {
  Box, Typography, Chip, Accordion, AccordionSummary, AccordionDetails, Alert,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { AnalyzeResult } from "@/lib/api";
import ScenarioCard from "./ScenarioCard";

function FeatureUnderstanding({ raw }: { raw: string }) {
  const text = raw.replace(/\*{1,3}/g, "").replace(/_{1,3}/g, "").trim();
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

  return (
    <Box sx={{ pt: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
      {sentences.map((sentence, i) => (
        <Typography key={i} sx={{ fontSize: 14, color: "#374151", lineHeight: 1.75 }}>
          {sentence}
        </Typography>
      ))}
    </Box>
  );
}

const RISK_BADGE: Record<string, { bg: string; text: string }> = {
  P1: { bg: "#fef2f2", text: "#b91c1c" },
  P2: { bg: "#fff7ed", text: "#c2410c" },
  P3: { bg: "#fefce8", text: "#a16207" },
  P4: { bg: "#f0fdf4", text: "#15803d" },
};

const STATUS_CONFIG = {
  existing: { border: "#818cf8", bg: "#eef2ff", label: "Existing Feature", text: "#4338ca" },
  partial:  { border: "#fbbf24", bg: "#fffbeb", label: "Partially Known Feature", text: "#92400e" },
  new:      { border: "#34d399", bg: "#ecfdf5", label: "New Feature", text: "#065f46" },
};

function Section({
  title, count, children, defaultOpen = false, accent,
}: {
  title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean; accent?: string;
}) {
  return (
    <Accordion defaultExpanded={defaultOpen} disableGutters>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ color: "#94a3b8", fontSize: 20 }} />}
        sx={{ px: 2, minHeight: 52 }}
      >
        <Box className="flex items-center gap-2 w-full">
          {accent && (
            <Box className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
          )}
          <Typography variant="body2" className="font-semibold text-slate-800">
            {title}
          </Typography>
          {count !== undefined && (
            <Chip
              label={count}
              size="small"
              sx={{ ml: "auto", mr: 1, bgcolor: "#f1f5f9", color: "#64748b", fontSize: 11, fontWeight: 600, height: 22 }}
            />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2, pb: 2, pt: 0, borderTop: "1px solid #f1f5f9" }}>
        {children}
      </AccordionDetails>
    </Accordion>
  );
}

export default function ResultsPanel({ result }: { result: AnalyzeResult }) {
  const status = STATUS_CONFIG[result.feature_status] ?? STATUS_CONFIG.new;

  return (
    <Box className="space-y-3">
      {/* Feature status banner */}
      <Box
        className="rounded-xl px-4 py-3 border-l-4"
        style={{ borderLeftColor: status.border, backgroundColor: status.bg }}
      >
        <Typography variant="caption" style={{ color: status.text }} className="font-bold uppercase tracking-wide text-[11px]">
          {status.label}
        </Typography>
        <Typography variant="body2" className="text-slate-600 mt-0.5">
          {result.feature_status_reason}
        </Typography>
      </Box>

      {/* Complexity badge */}
      <Box className="flex items-center gap-2">
        <Chip
          label={`Complexity: ${result.complexity_level?.toUpperCase()}`}
          size="small"
          sx={{
            fontWeight: 600,
            fontSize: 11,
            bgcolor: result.complexity_level === "complex" ? "#fef2f2" :
                     result.complexity_level === "moderate" ? "#fffbeb" : "#f0fdf4",
            color: result.complexity_level === "complex" ? "#b91c1c" :
                   result.complexity_level === "moderate" ? "#a16207" : "#15803d",
          }}
        />
      </Box>

      {/* Grounding warnings */}
      {result.kb_sparse && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon sx={{ fontSize: 18 }} />}
          sx={{ borderRadius: 2, bgcolor: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}
        >
          <strong>Sparse knowledge base</strong> — Scenarios are derived from the user story only. Upload BRD/SRS for grounded test cases.
        </Alert>
      )}
      {result.apis_inferred && (
        <Alert
          severity="info"
          icon={<InfoOutlinedIcon sx={{ fontSize: 18 }} />}
          sx={{ borderRadius: 2, bgcolor: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a5f" }}
        >
          <strong>APIs inferred</strong> — No API contracts found in KB; endpoints were estimated from the story. Upload a Swagger spec to verify.
        </Alert>
      )}

      {/* Feature Understanding */}
      <Section title="Feature Understanding" defaultOpen accent="#818cf8">
        <FeatureUnderstanding raw={result.feature_understanding ?? ""} />
      </Section>

      {/* Impacted Modules */}
      <Section title="Impacted Modules" count={result.impacted_modules?.length} accent="#34d399">
        <Box className="flex flex-wrap gap-2 pt-2">
          {result.impacted_modules?.map((m, i) => (
            <Chip
              key={i}
              label={m.name ?? m.id}
              size="small"
              variant="outlined"
              sx={{ borderColor: "#e2e8f0", color: "#475569", fontSize: 12 }}
            />
          ))}
          {!result.impacted_modules?.length && (
            <Typography variant="caption" className="text-slate-400">No impacted modules identified</Typography>
          )}
        </Box>
      </Section>

      {/* Event Flow */}
      {result.event_flow?.length > 0 && (
        <Section title="End-to-End Event Flow" count={result.event_flow.length} accent="#38bdf8">
          <Box className="pt-2 space-y-2">
            {result.event_flow.map((step, i) => {
              const layerColors: Record<string, { bg: string; text: string }> = {
                UI:           { bg: "#ede9fe", text: "#5b21b6" },
                API:          { bg: "#dbeafe", text: "#1d4ed8" },
                DB:           { bg: "#dcfce7", text: "#15803d" },
                Event:        { bg: "#fef9c3", text: "#a16207" },
                Consumer:     { bg: "#fce7f3", text: "#be185d" },
                Notification: { bg: "#e0f2fe", text: "#0369a1" },
              };
              const lc = layerColors[step.layer] ?? { bg: "#f1f5f9", text: "#475569" };
              return (
                <Box key={i} className="flex gap-3 items-start">
                  {/* Step number */}
                  <span className="shrink-0 w-6 h-6 rounded-full bg-sky-100 text-sky-700 text-[11px] flex items-center justify-center font-bold border border-sky-200 mt-0.5">
                    {step.step ?? i + 1}
                  </span>
                  <Box className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                    {/* Layer + component */}
                    <Box className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide"
                        style={{ backgroundColor: lc.bg, color: lc.text }}
                      >
                        {step.layer}
                      </span>
                      <Typography variant="caption" className="text-slate-500 font-medium">
                        {step.component}
                      </Typography>
                    </Box>
                    {/* Action */}
                    <Typography variant="body2" className="text-slate-800 font-medium leading-snug">
                      {step.action}
                    </Typography>
                    {/* Data */}
                    {step.data && (
                      <Typography variant="caption" className="text-slate-400 block mt-0.5 font-mono text-[11px]">
                        {step.data}
                      </Typography>
                    )}
                    {/* Validation point */}
                    {step.validation_point && (
                      <Box className="mt-1.5 flex items-start gap-1.5">
                        <span className="text-[10px] text-sky-600 font-semibold shrink-0 mt-0.5">✓ Verify:</span>
                        <Typography variant="caption" className="text-slate-500 leading-relaxed">
                          {step.validation_point}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Section>
      )}

      {/* Risk Areas */}
      <Section title="Risk Areas" count={result.risk_areas?.length} defaultOpen accent="#fb923c">
        <Box className="space-y-2 pt-2">
          {result.risk_areas?.map((r, i) => {
            const rc = RISK_BADGE[r.priority] ?? { bg: "#f8fafc", text: "#475569" };
            return (
              <Box key={i} className="flex items-start gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                <span
                  className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md"
                  style={{ backgroundColor: rc.bg, color: rc.text }}
                >
                  {r.priority}
                </span>
                <Box className="flex-1 min-w-0">
                  <Typography variant="body2" className="text-slate-800 font-medium">{r.feature}</Typography>
                  <Typography variant="caption" className="text-slate-400">{r.module}</Typography>
                  <ul className="mt-1.5 space-y-0.5">
                    {r.reasons?.map((reason, j) => (
                      <li key={j} className="text-xs text-slate-500 flex gap-1.5">
                        <span className="text-slate-300 mt-0.5 shrink-0">•</span>{reason}
                      </li>
                    ))}
                  </ul>
                </Box>
                <Box className="shrink-0 text-right">
                  <Typography variant="caption" className="text-slate-400 block text-[10px]">score</Typography>
                  <Typography variant="body2" className="text-slate-700 font-bold">{r.risk_score?.toFixed(2)}</Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Section>

      {/* Warnings */}
      <Section
        title="Heads-Up Warnings"
        count={result.heads_up_warnings?.length}
        accent="#fbbf24"
      >
        {result.heads_up_warnings?.length ? (
          <Box className="space-y-2 pt-2">
            {result.heads_up_warnings.map((w, i) => (
              <Box key={i} className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <Typography variant="body2" className="text-amber-800 font-medium">{w.warning}</Typography>
                {w.recommendation && (
                  <Typography variant="caption" className="text-slate-500 block mt-0.5">
                    → {w.recommendation}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="caption" className="text-slate-400 block pt-2">No warnings detected</Typography>
        )}
      </Section>

      {/* Test Scenarios */}
      <Section
        title="Test Scenarios"
        count={result.test_scenarios?.length}
        defaultOpen
        accent="#818cf8"
      >
        <Box className="space-y-2 pt-2">
          {result.test_scenarios?.map((s, i) => <ScenarioCard key={i} s={s} />)}
        </Box>
      </Section>

      {/* Gherkin */}
      <Section title="Gherkin Test Cases" count={result.gherkin_test_cases?.length} accent="#34d399">
        <Box className="space-y-3 pt-2">
          {result.gherkin_test_cases?.map((g, i) => {
            const tags = g.tags?.join(" ") ?? "";
            const given = g.given?.map((l) => `  ${l}`).join("\n") ?? "";
            const when  = g.when?.map((l) => `  ${l}`).join("\n") ?? "";
            const then  = g.then?.map((l) => `  ${l}`).join("\n") ?? "";
            const code  = `${tags}\nScenario: ${g.scenario_title}\n${given}\n${when}\n${then}`.trim();
            return (
              <Box key={i} className="rounded-xl overflow-hidden border border-slate-200">
                <Box className="px-3 py-1.5 bg-slate-100 border-b border-slate-200">
                  <Typography variant="caption" className="text-slate-500 font-mono text-[11px]">
                    {g.feature}
                  </Typography>
                </Box>
                <pre className="text-xs text-emerald-700 font-mono px-4 py-3 overflow-x-auto bg-white leading-relaxed">{code}</pre>
              </Box>
            );
          })}
        </Box>
      </Section>

      {/* Regression Suite */}
      <Section title="Regression Suite" count={result.regression_suite?.length} accent="#38bdf8">
        <Box className="pt-2 divide-y divide-slate-100">
          {result.regression_suite?.map((r, i) => (
            <Box key={i} className="flex items-center gap-3 py-2">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
                style={{
                  backgroundColor: r.priority === "MUST-RUN" ? "#fef2f2" : "#f1f5f9",
                  color: r.priority === "MUST-RUN" ? "#b91c1c" : "#475569",
                }}
              >
                {r.priority}
              </span>
              <Typography variant="body2" className="text-slate-700 flex-1">{r.test_case_name}</Typography>
              {r.reason && (
                <Typography variant="caption" className="text-slate-400 text-right max-w-[200px] shrink-0">{r.reason}</Typography>
              )}
            </Box>
          ))}
        </Box>
      </Section>

      {/* Missing Coverage */}
      <Section title="Missing Coverage" count={result.missing_coverage?.length} accent="#fb923c">
        <Box className="space-y-2 pt-2">
          {result.missing_coverage?.map((g, i) => (
            <Box key={i} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
              <Typography variant="body2" className="text-slate-800 font-medium">{g.area ?? g.description}</Typography>
              {g.recommendation && (
                <Typography variant="caption" className="text-slate-500 block mt-0.5">→ {g.recommendation}</Typography>
              )}
            </Box>
          ))}
          {!result.missing_coverage?.length && (
            <Typography variant="caption" className="text-slate-400">No coverage gaps identified</Typography>
          )}
        </Box>
      </Section>

      {/* API + Event Validation */}
      <Section title="API & Event Validation" count={result.api_event_validation?.length} accent="#818cf8">
        <Box className="space-y-3 pt-2">
          {result.api_event_validation?.map((api, i) => (
            <Box key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <Box className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-sky-100 text-sky-700">
                  {api.method}
                </span>
                <Typography variant="body2" className="font-mono text-slate-700 text-[13px]">{api.endpoint}</Typography>
              </Box>
              <ul className="space-y-1">
                {api.validations?.map((v, j) => (
                  <li key={j} className="text-xs text-slate-500 flex gap-2">
                    <span className="text-slate-300 mt-0.5 shrink-0">•</span>{v}
                  </li>
                ))}
              </ul>
            </Box>
          ))}
        </Box>
      </Section>
    </Box>
  );
}
