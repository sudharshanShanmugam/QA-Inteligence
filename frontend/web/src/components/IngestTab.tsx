"use client";

import { useState, useCallback } from "react";
import {
  Box, Typography, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Chip, LinearProgress,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import BlockIcon from "@mui/icons-material/Block";
import { ingestFiles, IngestFileResult } from "@/lib/api";

const DOC_TYPES = [
  { value: "auto", label: "Auto-detect" },
  { value: "brd",  label: "Business Requirements (BRD)" },
  { value: "srs",  label: "Software Requirements (SRS)" },
  { value: "user_story", label: "User Story" },
  { value: "bug_report", label: "Bug Report" },
  { value: "api_contract", label: "API Contract / Swagger" },
  { value: "db_schema",   label: "Database Schema" },
  { value: "test_case",   label: "Test Cases" },
];

const STATUS_ICON = {
  OK:       <CheckCircleIcon className="text-emerald-400" fontSize="small" />,
  REJECTED: <BlockIcon className="text-amber-400" fontSize="small" />,
  FAIL:     <ErrorIcon className="text-red-400" fontSize="small" />,
  PENDING:  <CircularProgress size={14} />,
};

const STATUS_COLOR: Record<string, string> = {
  OK: "text-emerald-400",
  REJECTED: "text-amber-400",
  FAIL: "text-red-400",
  PENDING: "text-slate-400",
};

export default function IngestTab() {
  const [docType, setDocType] = useState("auto");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<IngestFileResult[]>([]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setLoading(true);
    try {
      const res = await ingestFiles(files, docType);
      setResults((prev) => [...res.results, ...prev]);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }, [docType]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <Box className="max-w-3xl mx-auto space-y-6">
      <Box>
        <Typography variant="h5" className="font-semibold text-white mb-1">
          Ingest Documents
        </Typography>
        <Typography variant="body2" className="text-slate-400">
          Upload BRD, SRS, user stories, bug reports, API contracts, or DB schemas
          to build the knowledge base.
        </Typography>
      </Box>

      {/* Doc type selector */}
      <FormControl size="small" fullWidth>
        <InputLabel className="text-slate-400">Document Type</InputLabel>
        <Select
          value={docType}
          label="Document Type"
          onChange={(e) => setDocType(e.target.value)}
          className="bg-slate-800 text-slate-100"
          sx={{ "& .MuiOutlinedInput-notchedOutline": { borderColor: "#334155" } }}
        >
          {DOC_TYPES.map((d) => (
            <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Drop zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors ${
          dragging ? "border-sky-400 bg-sky-900/20" : "border-slate-600 hover:border-slate-400 bg-slate-800/40"
        }`}
      >
        <CloudUploadIcon className="text-slate-400 text-5xl" />
        <Typography variant="body1" className="text-slate-300 font-medium">
          Drop files here or click to upload
        </Typography>
        <Typography variant="caption" className="text-slate-500">
          PDF, DOCX, TXT, JSON, MD, YAML, SQL, XLSX
        </Typography>
        <input
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.docx,.txt,.json,.md,.yaml,.yml,.sql,.xlsx,.xls"
          onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
        />
      </label>

      {loading && (
        <Box>
          <Typography variant="caption" className="text-slate-400 mb-1 block">
            Processing files…
          </Typography>
          <LinearProgress className="rounded" />
        </Box>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Box className="space-y-2">
          <Typography variant="caption" className="text-slate-400 uppercase tracking-widest text-[10px]">
            Ingested files
          </Typography>
          {results.map((r, i) => (
            <Box
              key={i}
              className="flex items-start gap-3 bg-slate-800 rounded-lg px-4 py-3 border border-slate-700"
            >
              <Box className="mt-0.5">{STATUS_ICON[r.status] ?? STATUS_ICON.PENDING}</Box>
              <Box className="flex-1 min-w-0">
                <Typography variant="body2" className="text-slate-200 font-medium truncate">
                  {r.file}
                </Typography>
                {r.detected_type && (
                  <Typography variant="caption" className="text-slate-500">
                    Detected: {r.detected_type}
                  </Typography>
                )}
                {r.reason && (
                  <Typography variant="caption" className="text-amber-400 block">
                    {r.reason}
                  </Typography>
                )}
                {r.error && (
                  <Typography variant="caption" className="text-red-400 block">
                    {r.error}
                  </Typography>
                )}
              </Box>
              {r.status === "OK" && (
                <Box className="flex gap-2 shrink-0">
                  <Chip label={`${r.chunks} chunks`} size="small" className="bg-slate-700 text-slate-300 text-xs" />
                  {r.entities > 0 && (
                    <Chip label={`${r.entities} entities`} size="small" className="bg-slate-700 text-slate-300 text-xs" />
                  )}
                </Box>
              )}
              <Chip
                label={r.status}
                size="small"
                className={`shrink-0 text-xs font-semibold ${STATUS_COLOR[r.status]}`}
              />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
