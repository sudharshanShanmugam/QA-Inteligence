"use client";

import { useState } from "react";
import { Box, Typography, TextField, Button, CircularProgress, Alert, Chip } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { analyze, AnalyzeResult } from "@/lib/api";
import ResultsPanel from "./results/ResultsPanel";

export default function AnalyzeTab({ kbChunks }: { kbChunks: number }) {
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  const handleAnalyze = async () => {
    if (!story.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await analyze(story);
      setResult(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="space-y-6">
      <Box>
        <Typography variant="h5" className="font-semibold text-white mb-1">
          Analyze & Generate
        </Typography>
        <Typography variant="body2" className="text-slate-400">
          Describe a feature or paste a user story to generate a full QA test plan.
        </Typography>
      </Box>

      {/* KB status hint */}
      <Box className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${
        kbChunks > 0
          ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-300"
          : "bg-amber-950/40 border-amber-800/50 text-amber-300"
      }`}>
        <span>{kbChunks > 0 ? `✓ KB loaded: ${kbChunks} chunks` : "⚠ Knowledge base is empty — results will be LLM-inference only"}</span>
      </Box>

      {/* Input */}
      <TextField
        multiline
        minRows={4}
        maxRows={10}
        fullWidth
        placeholder="As an admin, I want to approve or decline payment submissions so that I can verify pilgrim payments before processing..."
        value={story}
        onChange={(e) => setStory(e.target.value)}
        variant="outlined"
        slotProps={{ input: { className: "bg-slate-800 text-slate-100 font-mono text-sm" } }}
        sx={{
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#334155" },
          "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#64748b" },
          "& .MuiInputBase-input": { color: "#e2e8f0" },
        }}
      />

      <Button
        variant="contained"
        disabled={loading || !story.trim()}
        onClick={handleAnalyze}
        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
        className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white font-semibold px-6"
        size="large"
      >
        {loading ? "Running Three-Brain Pipeline…" : "Run QA Analysis"}
      </Button>

      {error && (
        <Alert severity="error" className="bg-red-950/50 text-red-300 border border-red-800">
          {error}
        </Alert>
      )}

      {result && !loading && (
        <Box className="space-y-3">
          {/* Summary strip */}
          <Box className="flex flex-wrap gap-2 items-center">
            <Chip label={`Module: ${result.detected_module}`} size="small" className="bg-slate-700 text-slate-300" />
            <Chip label={`Priority: ${result.detected_priority}`} size="small" className="bg-slate-700 text-slate-300" />
            <Chip label={`Risk: ${result.overall_risk}`} size="small"
              className={result.overall_risk === "P1" ? "bg-red-900 text-red-300" :
                result.overall_risk === "P2" ? "bg-orange-900 text-orange-300" :
                "bg-emerald-900 text-emerald-300"}
            />
            <Chip label={`${result.total_scenarios} scenarios`} size="small" className="bg-sky-900 text-sky-300" />
            <Typography variant="caption" className="text-slate-500 ml-auto">
              {new Date(result.generated_at).toLocaleTimeString()}
            </Typography>
          </Box>

          <ResultsPanel result={result} />
        </Box>
      )}
    </Box>
  );
}
