"use client";

import { Box, Typography } from "@mui/material";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import { AnalyzeResult } from "@/lib/api";

function Delta({ before, after, label, invert = false }: { before: number; after: number; label: string; invert?: boolean }) {
  const diff = after - before;
  const improved = invert ? diff < 0 : diff > 0;
  const neutral = diff === 0;
  const color = neutral ? "#94a3b8" : improved ? "#10b981" : "#ef4444";
  const Icon = neutral ? TrendingFlatIcon : improved ? TrendingUpIcon : TrendingDownIcon;

  return (
    <Box sx={{ textAlign: "center", px: 2, py: 2.5, flex: 1 }}>
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
        {label}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: "#64748b" }}>{before}</Typography>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Icon sx={{ fontSize: 18, color }} />
          {!neutral && (
            <Typography sx={{ fontSize: 10, fontWeight: 700, color, lineHeight: 1 }}>
              {diff > 0 ? "+" : ""}{diff}
            </Typography>
          )}
        </Box>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{after}</Typography>
      </Box>
    </Box>
  );
}

export default function ComparePanel({ baseline, current }: { baseline: AnalyzeResult; current: AnalyzeResult }) {
  const newScenarios = (current.test_scenarios ?? []).filter(
    (s) => !(baseline.test_scenarios ?? []).some((b) => b.title.toLowerCase() === s.title.toLowerCase())
  );
  const removedScenarios = (baseline.test_scenarios ?? []).filter(
    (s) => !(current.test_scenarios ?? []).some((c) => c.title.toLowerCase() === s.title.toLowerCase())
  );

  const riskOrder = ["P1", "P2", "P3", "P4"];
  const riskChanged = baseline.overall_risk !== current.overall_risk;
  const riskImproved = riskOrder.indexOf(current.overall_risk) > riskOrder.indexOf(baseline.overall_risk);
  const riskColors: Record<string, string> = { P1: "#b91c1c", P2: "#c2410c", P3: "#a16207", P4: "#15803d" };

  return (
    <Box sx={{
      bgcolor: "white", borderRadius: "20px", overflow: "hidden",
      border: "1.5px solid #c7d2fe",
      boxShadow: "0 4px 24px rgba(99,102,241,0.08)",
      animation: "fadeUp 0.4s ease both",
      "@keyframes fadeUp": { from: { opacity: 0, transform: "translateY(16px)" }, to: { opacity: 1, transform: "translateY(0)" } },
    }}>
      {/* Header */}
      <Box sx={{
        px: 4, py: 2, display: "flex", alignItems: "center", gap: 2,
        background: "linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)",
        borderBottom: "1px solid #e0e7ff",
      }}>
        <Box sx={{
          width: 34, height: 34, borderRadius: "10px",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 10px rgba(99,102,241,0.25)",
        }}>
          <CompareArrowsIcon sx={{ fontSize: 18, color: "white" }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 14, color: "#1e293b" }}>Analysis Comparison</Typography>
          <Typography sx={{ fontSize: 11.5, color: "#64748b" }}>Baseline vs current run — see what changed after updating the KB</Typography>
        </Box>
        {riskChanged && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ px: "10px", py: "4px", borderRadius: "8px", bgcolor: riskColors[baseline.overall_risk] + "15", border: `1px solid ${riskColors[baseline.overall_risk]}30` }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: riskColors[baseline.overall_risk] }}>{baseline.overall_risk}</Typography>
            </Box>
            <Typography sx={{ fontSize: 12, color: "#94a3b8" }}>→</Typography>
            <Box sx={{ px: "10px", py: "4px", borderRadius: "8px", bgcolor: riskColors[current.overall_risk] + "15", border: `1px solid ${riskColors[current.overall_risk]}30` }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: riskColors[current.overall_risk] }}>{current.overall_risk}</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: riskImproved ? "#ef4444" : "#10b981" }}>
              {riskImproved ? "Risk increased" : "Risk reduced"}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Stats row */}
      <Box sx={{ display: "flex", borderBottom: "1px solid #f1f5f9" }}>
        {[
          { before: baseline.total_scenarios, after: current.total_scenarios, label: "Test Scenarios" },
          { before: (baseline.test_scenarios ?? []).filter(s => s.risk_level === "high").length, after: (current.test_scenarios ?? []).filter(s => s.risk_level === "high").length, label: "High Risk", invert: true },
          { before: baseline.risk_areas?.length ?? 0, after: current.risk_areas?.length ?? 0, label: "Risk Areas" },
          { before: baseline.gherkin_test_cases?.length ?? 0, after: current.gherkin_test_cases?.length ?? 0, label: "Gherkin Cases" },
        ].map((stat, i, arr) => (
          <Box key={stat.label} sx={{ flex: 1, borderRight: i < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>
            <Delta {...stat} />
          </Box>
        ))}
      </Box>

      {/* New / removed scenarios */}
      {(newScenarios.length > 0 || removedScenarios.length > 0) && (
        <Box sx={{ px: 4, py: 3, display: "flex", gap: 3 }}>
          {newScenarios.length > 0 && (
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#10b981" }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#065f46" }}>{newScenarios.length} new scenario{newScenarios.length > 1 ? "s" : ""}</Typography>
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                {newScenarios.slice(0, 5).map((s, i) => (
                  <Box key={i} sx={{ px: 2, py: 1, borderRadius: "8px", bgcolor: "#ecfdf5", border: "1px solid #a7f3d0" }}>
                    <Typography sx={{ fontSize: 12.5, color: "#065f46", fontWeight: 500 }}>{s.title}</Typography>
                  </Box>
                ))}
                {newScenarios.length > 5 && (
                  <Typography sx={{ fontSize: 11, color: "#94a3b8", pl: 1 }}>+{newScenarios.length - 5} more</Typography>
                )}
              </Box>
            </Box>
          )}
          {removedScenarios.length > 0 && (
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#94a3b8" }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{removedScenarios.length} scenario{removedScenarios.length > 1 ? "s" : ""} not in current run</Typography>
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                {removedScenarios.slice(0, 5).map((s, i) => (
                  <Box key={i} sx={{ px: 2, py: 1, borderRadius: "8px", bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <Typography sx={{ fontSize: 12.5, color: "#94a3b8", fontWeight: 500 }}>{s.title}</Typography>
                  </Box>
                ))}
                {removedScenarios.length > 5 && (
                  <Typography sx={{ fontSize: 11, color: "#94a3b8", pl: 1 }}>+{removedScenarios.length - 5} more</Typography>
                )}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
