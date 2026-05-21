"use client";

import { useState } from "react";
import { Box, Typography, Chip, Collapse, IconButton } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { TestScenario } from "@/lib/api";

const RISK_STYLE: Record<string, string> = {
  high:   "bg-red-900/60 text-red-300 border-red-700",
  medium: "bg-amber-900/60 text-amber-300 border-amber-700",
  low:    "bg-emerald-900/60 text-emerald-300 border-emerald-700",
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
  const title = humanizeTitle(s.title);

  return (
    <Box className="border border-slate-700 rounded-lg overflow-hidden bg-slate-800/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700/40 transition-colors"
      >
        <ExpandMoreIcon
          className={`text-slate-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          fontSize="small"
        />
        <Typography variant="body2" className="flex-1 text-slate-200 font-medium">
          {title}
        </Typography>
        <Box className="flex gap-1.5 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${RISK_STYLE[riskKey]}`}>
            {riskKey.toUpperCase()}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 border border-indigo-700">
            {TYPE_LABEL[s.type] ?? s.type}
          </span>
        </Box>
      </button>

      <Collapse in={open}>
        <Box className="px-4 pb-4 pt-1 border-t border-slate-700 space-y-3">
          {/* ID chip */}
          <Typography variant="caption" className="font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded text-[11px]">
            {s.id}
          </Typography>

          {s.traceability && (
            <Box className="bg-slate-900 rounded px-3 py-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Covers: </span>{s.traceability}
            </Box>
          )}

          {s.preconditions?.length > 0 && (
            <Box>
              <Typography variant="caption" className="text-slate-400 font-semibold block mb-1">
                Before you start
              </Typography>
              <ul className="space-y-0.5">
                {s.preconditions.map((p, i) => (
                  <li key={i} className="text-sm text-slate-300 flex gap-2">
                    <span className="text-slate-600 mt-0.5">•</span>{p}
                  </li>
                ))}
              </ul>
            </Box>
          )}

          {s.steps?.length > 0 && (
            <Box>
              <Typography variant="caption" className="text-slate-400 font-semibold block mb-1">
                Test Steps
              </Typography>
              <ol className="space-y-1">
                {s.steps.map((step, i) => (
                  <li key={i} className="text-sm text-slate-300 flex gap-2">
                    <span className="text-slate-500 shrink-0 font-mono text-xs mt-0.5">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </Box>
          )}

          {s.expected_result && (
            <Box className="bg-emerald-950/50 border-l-4 border-emerald-500 rounded px-3 py-2">
              <Typography variant="caption" className="text-emerald-400 font-semibold block mb-0.5">
                What you should see
              </Typography>
              <Typography variant="body2" className="text-slate-300">
                {s.expected_result}
              </Typography>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
