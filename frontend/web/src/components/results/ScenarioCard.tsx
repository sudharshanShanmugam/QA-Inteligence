"use client";

import { useState } from "react";
import { Box, Typography, Collapse } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import { TestScenario } from "@/lib/api";

const RISK_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  high:   { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
  medium: { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  low:    { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
};

const TYPE_LABEL: Record<string, string> = {
  functional:            "Functional",
  boundary_value:        "Boundary Value",
  equivalence_partition: "Equivalence Partition",
  pairwise:              "Combination Test",
  decision_table:        "Decision Check",
  state_transition:      "State Transition",
  event_flow:            "Event Flow",
  edge_case:             "Edge Case",
};

function humanizeTitle(title: string): string {
  // STATE →[EVENT]→ STATE
  const arrow = title.match(/^(.+?):\s*([A-Z][A-Z_]+)\s*→\[([A-Z_]+)\]→\s*([A-Z][A-Z_]+)$/);
  if (arrow) {
    const [, entity, from, event, to] = arrow;
    return `${entity}: Status changes from '${from.replace(/_/g, " ")}' to '${to.replace(/_/g, " ")}' when '${event.replace(/_/g, " ")}' is triggered`;
  }
  // REJECT 'EVENT' in state 'STATE'
  const reject = title.match(/^(.+?):\s*REJECT\s+'([A-Z_]+)'\s+in state\s+'([A-Z_]+)'$/);
  if (reject) {
    const [, entity, event, state] = reject;
    return `${entity}: '${event.replace(/_/g, " ")}' should be blocked when status is '${state.replace(/_/g, " ")}'`;
  }
  // Sequence [S → S → S]
  const seq = title.match(/^(.+?):\s*Sequence\s+\[(.+)\]$/);
  if (seq) {
    const [, entity, steps] = seq;
    const readable = steps.split("→").map((s) => s.trim().replace(/_/g, " ")).join(" → ");
    return `${entity}: End-to-end journey — ${readable}`;
  }
  return title
    .replace(/^Combination test\s*[—-]\s*/i, "Test with: ")
    .replace(/^Decision:\s*/i, "Check behaviour when: ");
}

export default function ScenarioCard({ s }: { s: TestScenario }) {
  const [open, setOpen] = useState(false);
  const riskKey = s.risk_level?.toLowerCase() ?? "low";
  const riskStyle = RISK_STYLE[riskKey] ?? RISK_STYLE.low;
  const title = humanizeTitle(s.title);

  return (
    <Box
      className="border border-slate-200 rounded-xl overflow-hidden bg-white"
      sx={{ boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.04)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <ExpandMoreIcon
          sx={{
            color: "#94a3b8",
            fontSize: 20,
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        />
        <Typography variant="body2" className="flex-1 text-slate-800 font-medium text-sm leading-snug">
          {title}
        </Typography>
        <Box className="flex gap-1.5 shrink-0 items-center">
          <span
            className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold border"
            style={{ backgroundColor: riskStyle.bg, color: riskStyle.text, borderColor: riskStyle.border }}
          >
            {riskKey.toUpperCase()}
          </span>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
            {TYPE_LABEL[s.type] ?? s.type}
          </span>
        </Box>
      </button>

      <Collapse in={open}>
        <Box className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3">
          {/* ID */}
          <Typography variant="caption" className="font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded text-[11px] inline-block border border-slate-100">
            {s.id}
          </Typography>

          {s.traceability && (
            <Box className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-slate-600">
              <span className="font-semibold text-indigo-700">Covers: </span>{s.traceability}
            </Box>
          )}

          {s.preconditions?.length > 0 && (
            <Box>
              <Typography variant="caption" className="text-slate-500 font-semibold block mb-1.5 uppercase tracking-wide text-[10px]">
                Preconditions
              </Typography>
              <ul className="space-y-1">
                {s.preconditions.map((p, i) => (
                  <li key={i} className="text-sm text-slate-600 flex gap-2">
                    <span className="text-slate-300 mt-0.5 shrink-0">•</span>{p}
                  </li>
                ))}
              </ul>
            </Box>
          )}

          {s.steps?.length > 0 && (
            <Box>
              <Typography variant="caption" className="text-slate-500 font-semibold block mb-1.5 uppercase tracking-wide text-[10px]">
                Test Steps
              </Typography>
              <ol className="space-y-1.5">
                {s.steps.map((step, i) => (
                  <li key={i} className="text-sm text-slate-600 flex gap-2.5">
                    <span className="text-slate-400 shrink-0 font-mono text-xs mt-0.5 w-4 text-right">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </Box>
          )}

          {s.expected_result && (
            <Box className="bg-emerald-50 border-l-4 border-emerald-400 rounded-r-lg px-3 py-2.5">
              <Box className="flex items-center gap-1.5 mb-1">
                <CheckCircleOutlinedIcon sx={{ fontSize: 14, color: "#10b981" }} />
                <Typography variant="caption" className="text-emerald-700 font-semibold uppercase tracking-wide text-[10px]">
                  Expected Result
                </Typography>
              </Box>
              <Typography variant="body2" className="text-slate-600">
                {s.expected_result}
              </Typography>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
