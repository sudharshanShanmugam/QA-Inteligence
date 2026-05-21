"use client";

import { useState } from "react";
import {
  Box, Typography, Chip, Accordion, AccordionSummary,
  AccordionDetails, Alert,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { AnalyzeResult } from "@/lib/api";
import ScenarioCard from "./ScenarioCard";

const RISK_BADGE: Record<string, string> = {
  P1: "bg-red-600 text-white",
  P2: "bg-orange-500 text-white",
  P3: "bg-yellow-500 text-black",
  P4: "bg-emerald-600 text-white",
};

const STATUS_COLORS = {
  existing: { border: "#1a5276", bg: "#0d2137", label: "EXISTING FEATURE", text: "#5dade2" },
  partial:  { border: "#7d6608", bg: "#2d2300", label: "PARTIALLY KNOWN FEATURE", text: "#f1c40f" },
  new:      { border: "#1e8449", bg: "#0d2318", label: "NEW FEATURE", text: "#58d68d" },
};

function Section({
  title, count, children, defaultOpen = false,
}: { title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <Accordion
      defaultExpanded={defaultOpen}
      className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden shadow-none"
      sx={{ "&:before": { display: "none" }, borderRadius: "8px !important" }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon className="text-slate-400" />}
        className="px-4 py-0 min-h-[48px]"
      >
        <Box className="flex items-center gap-2 w-full">
          <Typography variant="body2" className="font-semibold text-slate-200">
            {title}
          </Typography>
          {count !== undefined && (
            <Chip label={count} size="small" className="bg-slate-700 text-slate-300 text-xs ml-auto mr-2" />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails className="px-4 pb-4 pt-0 border-t border-slate-700">
        {children}
      </AccordionDetails>
    </Accordion>
  );
}

export default function ResultsPanel({ result }: { result: AnalyzeResult }) {
  const status = STATUS_COLORS[result.feature_status] ?? STATUS_COLORS.new;

  return (
    <Box className="space-y-3">
      {/* Feature status banner */}
      <Box
        className="rounded-lg px-4 py-3 border-l-4"
        style={{ borderColor: status.border, backgroundColor: status.bg }}
      >
        <Typography variant="caption" style={{ color: status.text }} className="font-bold">
          {status.label}
        </Typography>
        <Typography variant="body2" className="text-slate-400 mt-0.5 text-sm">
          {result.feature_status_reason}
        </Typography>
      </Box>

      {/* Complexity badge */}
      <Chip
        label={`Complexity: ${result.complexity_level?.toUpperCase()}`}
        size="small"
        className={`font-semibold ${
          result.complexity_level === "complex" ? "bg-red-900 text-red-300" :
          result.complexity_level === "moderate" ? "bg-amber-900 text-amber-300" :
          "bg-emerald-900 text-emerald-300"
        }`}
      />

      {/* Grounding warnings */}
      {result.kb_sparse && (
        <Alert severity="warning" icon={<WarningAmberIcon />} className="bg-amber-950/50 text-amber-300 border border-amber-800">
          <strong>Sparse KB</strong> — Scenarios are derived from the user story only. Upload BRD/SRS for grounded test cases.
        </Alert>
      )}
      {result.apis_inferred && (
        <Alert severity="info" icon={<InfoOutlinedIcon />} className="bg-sky-950/50 text-sky-300 border border-sky-800">
          <strong>APIs inferred</strong> — No API contracts found in KB; endpoints were guessed from the story. Upload a Swagger spec to verify.
        </Alert>
      )}

      {/* Feature Understanding */}
      <Section title="Feature Understanding" defaultOpen>
        <Typography variant="body2" className="text-slate-300 whitespace-pre-line leading-relaxed">
          {result.feature_understanding}
        </Typography>
      </Section>

      {/* Impacted Modules */}
      <Section title="Impacted Modules" count={result.impacted_modules?.length}>
        <Box className="flex flex-wrap gap-2">
          {result.impacted_modules?.map((m, i) => (
            <Chip
              key={i}
              label={m.name ?? m.id}
              size="small"
              className="bg-slate-700 text-slate-300"
              variant="outlined"
            />
          ))}
          {!result.impacted_modules?.length && (
            <Typography variant="caption" className="text-slate-500">No impacted modules identified</Typography>
          )}
        </Box>
      </Section>

      {/* Event Flow */}
      {result.event_flow?.length > 0 && (
        <Section title="End-to-End Event Flow" count={result.event_flow.length}>
          <ol className="space-y-2">
            {result.event_flow.map((step, i) => (
              <li key={i} className="flex gap-3 items-start text-sm">
                <span className="shrink-0 w-5 h-5 rounded-full bg-sky-900 text-sky-300 text-[10px] flex items-center justify-center font-bold">
                  {step.step ?? i + 1}
                </span>
                <Typography variant="body2" className="text-slate-300">{step.description}</Typography>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Risk Areas */}
      <Section title="Risk Areas" count={result.risk_areas?.length} defaultOpen>
        <Box className="space-y-2">
          {result.risk_areas?.map((r, i) => (
            <Box key={i} className="flex items-start gap-3 bg-slate-900 rounded-lg p-3">
              <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded ${RISK_BADGE[r.priority] ?? "bg-slate-600 text-white"}`}>
                {r.priority}
              </span>
              <Box>
                <Typography variant="body2" className="text-slate-200 font-medium">{r.feature}</Typography>
                <Typography variant="caption" className="text-slate-500">{r.module}</Typography>
                <ul className="mt-1 space-y-0.5">
                  {r.reasons?.map((reason, j) => (
                    <li key={j} className="text-xs text-slate-400 flex gap-1.5">
                      <span className="text-slate-600 mt-0.5">•</span>{reason}
                    </li>
                  ))}
                </ul>
              </Box>
              <Box className="ml-auto shrink-0 text-right">
                <Typography variant="caption" className="text-slate-500 block">score</Typography>
                <Typography variant="body2" className="text-slate-200 font-bold">{r.risk_score?.toFixed(2)}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Section>

      {/* Warnings */}
      <Section
        title={`Heads-Up Warnings — ${result.heads_up_warnings?.length ?? 0} found`}
        count={result.heads_up_warnings?.length}
      >
        {result.heads_up_warnings?.length ? (
          <Box className="space-y-2">
            {result.heads_up_warnings.map((w, i) => (
              <Box key={i} className="bg-amber-950/40 border border-amber-800/50 rounded-lg px-3 py-2">
                <Typography variant="body2" className="text-amber-300 font-medium">{w.warning}</Typography>
                {w.recommendation && (
                  <Typography variant="caption" className="text-slate-400 block mt-0.5">
                    → {w.recommendation}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="caption" className="text-slate-500">No warnings detected</Typography>
        )}
      </Section>

      {/* Test Scenarios */}
      <Section
        title={`Test Scenarios — ${result.test_scenarios?.length ?? 0} generated`}
        count={result.test_scenarios?.length}
      >
        <Box className="space-y-2">
          {result.test_scenarios?.map((s, i) => <ScenarioCard key={i} s={s} />)}
        </Box>
      </Section>

      {/* Gherkin */}
      <Section title="Gherkin Test Cases" count={result.gherkin_test_cases?.length}>
        <Box className="space-y-3">
          {result.gherkin_test_cases?.map((g, i) => {
            const tags = g.tags?.join(" ") ?? "";
            const given = g.given?.map((l) => `  ${l}`).join("\n") ?? "";
            const when = g.when?.map((l) => `  ${l}`).join("\n") ?? "";
            const then = g.then?.map((l) => `  ${l}`).join("\n") ?? "";
            const code = `${tags}\nScenario: ${g.scenario_title}\n${given}\n${when}\n${then}`.trim();
            return (
              <Box key={i} className="bg-slate-900 rounded-lg overflow-hidden">
                <Typography variant="caption" className="block px-3 py-1 bg-slate-950 text-slate-500 font-mono text-[10px]">
                  {g.feature}
                </Typography>
                <pre className="text-xs text-emerald-300 font-mono px-3 py-2 overflow-x-auto">{code}</pre>
              </Box>
            );
          })}
        </Box>
      </Section>

      {/* Regression Suite */}
      <Section
        title={`Regression Suite — ${(result.regression_suite?.length ?? 0)} TCs`}
        count={result.regression_suite?.length}
      >
        <Box className="space-y-1">
          {result.regression_suite?.map((r, i) => (
            <Box key={i} className="flex items-center gap-3 py-1.5 border-b border-slate-700 last:border-0">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.priority === "MUST-RUN" ? "bg-red-900 text-red-300" : "bg-slate-700 text-slate-300"}`}>
                {r.priority}
              </span>
              <Typography variant="body2" className="text-slate-300 flex-1">{r.test_case_name}</Typography>
              {r.reason && (
                <Typography variant="caption" className="text-slate-500 text-right max-w-[200px]">{r.reason}</Typography>
              )}
            </Box>
          ))}
        </Box>
      </Section>

      {/* Missing Coverage */}
      <Section title="Missing Coverage" count={result.missing_coverage?.length}>
        <Box className="space-y-2">
          {result.missing_coverage?.map((g, i) => (
            <Box key={i} className="bg-slate-900 rounded-lg px-3 py-2">
              <Typography variant="body2" className="text-slate-200 font-medium">{g.area ?? g.description}</Typography>
              {g.recommendation && (
                <Typography variant="caption" className="text-slate-500 block mt-0.5">→ {g.recommendation}</Typography>
              )}
            </Box>
          ))}
          {!result.missing_coverage?.length && (
            <Typography variant="caption" className="text-slate-500">No coverage gaps identified</Typography>
          )}
        </Box>
      </Section>

      {/* API + Event Validation */}
      <Section title="API + Event Validation" count={result.api_event_validation?.length}>
        <Box className="space-y-3">
          {result.api_event_validation?.map((api, i) => (
            <Box key={i} className="bg-slate-900 rounded-lg p-3">
              <Box className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-sky-900 text-sky-300">
                  {api.method}
                </span>
                <Typography variant="body2" className="font-mono text-slate-300">{api.endpoint}</Typography>
              </Box>
              <ul className="space-y-0.5">
                {api.validations?.map((v, j) => (
                  <li key={j} className="text-xs text-slate-400 flex gap-2">
                    <span className="text-slate-600 mt-0.5 shrink-0">•</span>{v}
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
