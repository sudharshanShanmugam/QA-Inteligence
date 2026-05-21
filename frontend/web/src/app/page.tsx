"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Typography, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Button, CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BoltIcon from "@mui/icons-material/Bolt";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import DeleteIcon from "@mui/icons-material/Delete";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import StorageIcon from "@mui/icons-material/Storage";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import InsightsIcon from "@mui/icons-material/Insights";
import DataObjectIcon from "@mui/icons-material/DataObject";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import HubIcon from "@mui/icons-material/Hub";
import BiotechIcon from "@mui/icons-material/Biotech";
import PsychologyIcon from "@mui/icons-material/Psychology";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import GppGoodIcon from "@mui/icons-material/GppGood";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import FindInPageIcon from "@mui/icons-material/FindInPage";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import BugReportIcon from "@mui/icons-material/BugReport";
import ApiIcon from "@mui/icons-material/Api";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import { listProjects, createProject, deleteProject, Project } from "@/lib/api";

// ── Colour palette for project cards (cycles by index) ────────────────────────
const CARD_PALETTES = [
  { from: "#6366f1", to: "#818cf8", soft: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
  { from: "#0ea5e9", to: "#38bdf8", soft: "#e0f2fe", text: "#0369a1", border: "#bae6fd" },
  { from: "#10b981", to: "#34d399", soft: "#ecfdf5", text: "#065f46", border: "#a7f3d0" },
  { from: "#8b5cf6", to: "#a78bfa", soft: "#f5f3ff", text: "#5b21b6", border: "#ddd6fe" },
  { from: "#f59e0b", to: "#fbbf24", soft: "#fffbeb", text: "#92400e", border: "#fde68a" },
  { from: "#ec4899", to: "#f472b6", soft: "#fdf2f8", text: "#9d174d", border: "#fbcfe8" },
];

function getPalette(index: number) {
  return CARD_PALETTES[index % CARD_PALETTES.length];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ projects }: { projects: Project[] }) {
  const totalChunks = projects.reduce((s, p) => s + (p.chunks ?? 0), 0);
  const totalFiles  = projects.reduce((s, p) => s + (p.file_count ?? 0), 0);
  const readyCount  = projects.filter((p) => p.chunks > 0).length;

  const stats = [
    { icon: FolderOpenIcon, label: "Projects", value: projects.length, color: "#4f46e5" },
    { icon: StorageIcon,    label: "Total Chunks", value: totalChunks.toLocaleString(), color: "#0ea5e9" },
    { icon: DataObjectIcon, label: "Total Files", value: totalFiles, color: "#10b981" },
    { icon: CheckCircleIcon,label: "KB Ready", value: readyCount, color: "#8b5cf6" },
  ];

  return (
    <Box className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {stats.map(({ icon: Icon, label, value, color }) => (
        <Box
          key={label}
          className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm"
        >
          <Box
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: color + "18" }}
          >
            <Icon sx={{ fontSize: 18, color }} />
          </Box>
          <Box>
            <Typography
              variant="h6"
              className="font-bold leading-none"
              style={{ color }}
            >
              {value}
            </Typography>
            <Typography variant="caption" className="text-slate-400 text-[11px]">
              {label}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Box
      sx={{
        borderRadius: "24px",
        border: "1.5px dashed #e2e8f0",
        background: "linear-gradient(150deg, #fafbff 0%, #f8fafc 50%, #f0fdf4 100%)",
        py: 8,
        px: { xs: 3, sm: 6 },
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle background dot grid */}
      <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="esgrid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.2" fill="#c7d2fe" fillOpacity="0.35" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#esgrid)" />
        </svg>
      </Box>

      {/* Pipeline illustration SVG */}
      <Box sx={{ display: "flex", justifyContent: "center", mb: 5, position: "relative" }}>
        <svg viewBox="0 0 560 160" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 560, height: "auto" }}>
          <defs>
            <radialGradient id="es-glow1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#a5b4fc" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="es-glow2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* ── DOCS block (left) ── */}
          <ellipse cx="100" cy="80" rx="72" ry="55" fill="url(#es-glow1)" />
          {/* Back doc */}
          <rect x="48" y="42" width="72" height="88" rx="8" fill="#e0e7ff" stroke="#c7d2fe" strokeWidth="1.5" transform="rotate(-5 84 86)" />
          {/* Middle doc */}
          <rect x="54" y="36" width="72" height="88" rx="8" fill="#eef2ff" stroke="#c7d2fe" strokeWidth="1.5" transform="rotate(-2 90 80)" />
          {/* Front doc */}
          <rect x="60" y="30" width="72" height="88" rx="8" fill="white" stroke="#c7d2fe" strokeWidth="1.5" />
          {/* Doc header bar */}
          <rect x="60" y="30" width="72" height="20" rx="8" fill="#4f46e5" />
          <rect x="60" y="42" width="72" height="8" rx="0" fill="#4f46e5" />
          {/* Doc lines */}
          <rect x="70" y="60" width="52" height="5" rx="2.5" fill="#e0e7ff" />
          <rect x="70" y="70" width="44" height="4" rx="2" fill="#f1f5f9" />
          <rect x="70" y="79" width="48" height="4" rx="2" fill="#f1f5f9" />
          <rect x="70" y="88" width="36" height="4" rx="2" fill="#f1f5f9" />
          {/* Labels */}
          <rect x="63" y="34" width="22" height="7" rx="3.5" fill="white" fillOpacity="0.2" />
          <text x="74" y="40" textAnchor="middle" fill="white" fontSize="5" fontFamily="system-ui" fontWeight="700">BRD</text>
          <text x="96" y="126" textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="system-ui" fontWeight="600">Your Documents</text>

          {/* ── Connector 1 (Docs → AI) ── */}
          <path d="M 140 80 Q 196 80 212 80" stroke="#c7d2fe" strokeWidth="2" strokeDasharray="5 4" fill="none" />
          {[0,1,2,3].map(i => (
            <circle key={i} cx={148 + i * 16} cy="80" r="2" fill="#a5b4fc" fillOpacity={0.3 + i * 0.18} />
          ))}
          <path d="M 208 76 L 214 80 L 208 84" stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

          {/* ── AI BRAIN block (center) ── */}
          <circle cx="280" cy="80" r="55" fill="#eef2ff" stroke="#c7d2fe" strokeWidth="1.5" />
          <circle cx="280" cy="80" r="42" fill="white" stroke="#e0e7ff" strokeWidth="1" />
          {/* Brain icon */}
          <path d="M268,74 C265,67 257,66 255,72 C252,79 257,85 263,86 C262,91 264,96 270,95 L270,104 L290,104 L290,95 C296,96 298,91 297,86 C303,85 308,79 305,72 C303,66 295,67 292,74 C290,70 286,68 280,68 C274,68 270,70 268,74 Z" fill="#4f46e5" fillOpacity="0.85" />
          {/* Spark accents */}
          <path d="M280 58 L282 63 L287 65 L282 67 L280 72 L278 67 L273 65 L278 63 Z" fill="#fbbf24" fillOpacity="0.9" />
          <circle cx="258" cy="64" r="3" fill="#a5b4fc" fillOpacity="0.5" />
          <circle cx="302" cy="64" r="2.5" fill="#67e8f9" fillOpacity="0.5" />
          <text x="280" y="120" textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="system-ui" fontWeight="600">Three-Brain AI</text>

          {/* ── Connector 2 (AI → Test Plan) ── */}
          <path d="M 348 80 Q 364 80 420 80" stroke="#a7f3d0" strokeWidth="2" strokeDasharray="5 4" fill="none" />
          {[0,1,2,3].map(i => (
            <circle key={i} cx={356 + i * 16} cy="80" r="2" fill="#34d399" fillOpacity={0.3 + i * 0.18} />
          ))}
          <path d="M 416 76 L 422 80 L 416 84" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

          {/* ── TEST PLAN block (right) ── */}
          <ellipse cx="468" cy="80" rx="72" ry="55" fill="url(#es-glow2)" />
          <rect x="424" y="28" width="88" height="104" rx="10" fill="white" stroke="#a7f3d0" strokeWidth="1.5" />
          {/* Header */}
          <rect x="424" y="28" width="88" height="22" rx="10" fill="#10b981" />
          <rect x="424" y="40" width="88" height="10" rx="0" fill="#10b981" />
          <text x="468" y="43" textAnchor="middle" fill="white" fontSize="8" fontFamily="system-ui" fontWeight="700">TEST PLAN</text>
          {/* Checklist rows */}
          {[0,1,2,3,4].map(i => (
            <g key={i}>
              <rect x="434" y={56 + i * 14} width="8" height="8" rx="2" fill={i < 3 ? "#10b981" : "#e2e8f0"} />
              {i < 3 && <path d={`M${436} ${60 + i * 14} L${438} ${62 + i * 14} L${441} ${58 + i * 14}`} stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
              <rect x="446" y={58 + i * 14} width={i === 0 ? 52 : i === 1 ? 42 : i === 2 ? 48 : i === 3 ? 38 : 44} height="4" rx="2" fill={i < 3 ? "#dcfce7" : "#f8fafc"} />
            </g>
          ))}
          <text x="468" y="143" textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="system-ui" fontWeight="600">Generated Tests</text>
        </svg>
      </Box>

      {/* Headline */}
      <Typography variant="h5" sx={{ fontWeight: 800, color: "#1e293b", mb: 1.5, lineHeight: 1.2 }}>
        From docs to test plans — in seconds.
      </Typography>
      <Typography variant="body2" sx={{ color: "#64748b", mb: 5, maxWidth: 400, mx: "auto", lineHeight: 1.7 }}>
        Drop in a BRD, SRS, or user story. QA Intelligence analyses every requirement and generates
        a full test plan automatically.
      </Typography>

      {/* Step chips */}
      <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "10px", mb: 5 }}>
        {[
          { n: "1", label: "Upload your docs", color: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe" },
          { n: "2", label: "AI runs analysis",  color: "#0ea5e9", bg: "#e0f2fe", border: "#bae6fd" },
          { n: "3", label: "Get test scenarios", color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0" },
        ].map((s) => (
          <Box
            key={s.n}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              px: "14px",
              py: "7px",
              borderRadius: "999px",
              fontSize: 13,
              fontWeight: 600,
              backgroundColor: s.bg,
              color: s.color,
              border: `1px solid ${s.border}`,
            }}
          >
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                backgroundColor: s.color,
                color: "white",
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {s.n}
            </Box>
            {s.label}
          </Box>
        ))}
      </Box>

      {/* CTA */}
      <button
        onClick={onCreate}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "12px 32px",
          borderRadius: "14px",
          backgroundColor: "#4f46e5",
          color: "white",
          fontWeight: 700,
          fontSize: 15,
          border: "none",
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(79,70,229,0.3)",
          transition: "background 0.15s, transform 0.1s",
        }}
        onMouseOver={e => (e.currentTarget.style.backgroundColor = "#4338ca")}
        onMouseOut={e => (e.currentTarget.style.backgroundColor = "#4f46e5")}
      >
        <AddIcon sx={{ fontSize: 19 }} />
        Create your first project
      </button>

      <Typography variant="caption" sx={{ display: "block", color: "#94a3b8", mt: 2, fontSize: 11 }}>
        PDF · DOCX · TXT · JSON · YAML · SQL · XLSX supported
      </Typography>
    </Box>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────
function ProjectCard({
  project, index, onOpen, onDelete,
}: {
  project: Project; index: number; onOpen: () => void; onDelete: () => void;
}) {
  const pal = getPalette(index);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fillPct = Math.min(100, Math.round((project.chunks / Math.max(project.chunks, 100)) * 100));

  return (
    <>
      <Box
        className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-300 cursor-pointer group flex flex-col"
        onClick={onOpen}
        style={{ animationFillMode: "both" }}
      >
        {/* Gradient header bar */}
        <Box
          className="h-1.5 w-full"
          style={{ background: `linear-gradient(90deg, ${pal.from}, ${pal.to})` }}
        />

        <Box className="p-5 flex flex-col gap-4 flex-1">
          {/* Top row */}
          <Box className="flex items-start justify-between">
            {/* Icon */}
            <Box
              className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: `linear-gradient(135deg, ${pal.from}, ${pal.to})` }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 20, color: "white" }} />
            </Box>

            {/* Delete button */}
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <DeleteIcon sx={{ fontSize: 16 }} />
            </button>
          </Box>

          {/* Name + description */}
          <Box className="flex-1">
            <Typography variant="body1" className="font-bold text-slate-900 leading-tight mb-1.5">
              {project.name}
            </Typography>
            <Typography variant="body2" className="text-slate-400 text-sm leading-relaxed line-clamp-2">
              {project.description || "No description added"}
            </Typography>
          </Box>

          {/* KB bar */}
          <Box>
            <Box className="flex justify-between items-center mb-1.5">
              <Typography variant="caption" className="text-slate-400 text-[11px] font-medium">
                Knowledge Base
              </Typography>
              <Typography
                variant="caption"
                className="text-[11px] font-bold"
                style={{ color: project.chunks > 0 ? pal.from : "#94a3b8" }}
              >
                {project.chunks > 0 ? `${project.chunks} chunks` : "Empty"}
              </Typography>
            </Box>
            <Box className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <Box
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${fillPct}%`,
                  background: `linear-gradient(90deg, ${pal.from}, ${pal.to})`,
                  minWidth: project.chunks > 0 ? "8px" : "0",
                }}
              />
            </Box>
          </Box>

          {/* Footer */}
          <Box className="flex items-center justify-between pt-1 border-t border-slate-100">
            <Box className="flex items-center gap-3 text-[11px] text-slate-400">
              <Box className="flex items-center gap-1">
                <DataObjectIcon sx={{ fontSize: 12 }} />
                {project.file_count} file{project.file_count !== 1 ? "s" : ""}
              </Box>
              <Box className="flex items-center gap-1">
                <CalendarTodayIcon sx={{ fontSize: 11 }} />
                {formatDate(project.created_at)}
              </Box>
            </Box>
            <Box
              className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={project.chunks > 0
                ? { backgroundColor: pal.soft, color: pal.text, border: `1px solid ${pal.border}` }
                : { backgroundColor: "#f1f5f9", color: "#94a3b8", border: "1px solid #e2e8f0" }
              }
            >
              {project.chunks > 0 ? "Ready" : "Empty KB"}
            </Box>
          </Box>
        </Box>

        {/* Open footer */}
        <Box
          className="px-5 py-2.5 border-t border-slate-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-200"
          style={{ backgroundColor: pal.soft }}
        >
          <Typography variant="caption" className="font-semibold" style={{ color: pal.text }}>
            Open project
          </Typography>
          <Typography variant="caption" style={{ color: pal.from }}>→</Typography>
        </Box>
      </Box>

      {/* Delete confirm overlay */}
      {confirmDelete && (
        <Box
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <Box className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-slate-200">
            <Box className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mb-3">
              <DeleteIcon sx={{ fontSize: 20, color: "#ef4444" }} />
            </Box>
            <Typography variant="body1" className="font-bold text-slate-900 mb-1">
              Delete "{project.name}"?
            </Typography>
            <Typography variant="body2" className="text-slate-400 mb-5 leading-relaxed">
              This permanently deletes the project and all its ingested knowledge base data. This cannot be undone.
            </Typography>
            <Box className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setConfirmDelete(false); onDelete(); }}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors shadow-sm shadow-red-200"
              >
                Delete project
              </button>
            </Box>
          </Box>
        </Box>
      )}
    </>
  );
}

// ── Three-Brain Pipeline ──────────────────────────────────────────────────────
function PipelineSection() {
  const brains = [
    {
      icon: ManageSearchIcon,
      name: "RAG Engine",
      tagline: "Brain 1",
      desc: "Semantic search over your ingested documents. Retrieves the most relevant BRDs, SRS, bug reports, and API contracts to ground every test output.",
      tech: ["ChromaDB", "Embeddings", "Cosine Similarity"],
      from: "#4f46e5", to: "#818cf8", soft: "#eef2ff", border: "#c7d2fe", text: "#3730a3",
    },
    {
      icon: HubIcon,
      name: "Graph Brain",
      tagline: "Brain 2",
      desc: "Builds a knowledge graph of entities, modules, and relationships. Maps dependencies, event flows, and impact chains across your system.",
      tech: ["NetworkX", "Entity Extraction", "Graph Queries"],
      from: "#0ea5e9", to: "#38bdf8", soft: "#e0f2fe", border: "#bae6fd", text: "#0369a1",
    },
    {
      icon: PsychologyIcon,
      name: "LLM Brain",
      tagline: "Brain 3",
      desc: "Synthesises RAG context and graph insights to generate structured test plans — scenarios, Gherkin cases, risk areas, and regression suites.",
      tech: ["DeepInfra", "GPT-class LLM", "Structured Output"],
      from: "#10b981", to: "#34d399", soft: "#ecfdf5", border: "#a7f3d0", text: "#065f46",
    },
  ];

  return (
    <Box className="mt-16">
      {/* Header */}
      <Box className="text-center mb-10">
        <Box className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 mb-3">
          <ElectricBoltIcon sx={{ fontSize: 14, color: "#4f46e5" }} />
          <Typography variant="caption" className="text-indigo-600 font-semibold text-[11px] uppercase tracking-widest">
            How it works
          </Typography>
        </Box>
        <Typography variant="h5" className="font-bold text-slate-900 mb-2">
          Three-Brain AI Architecture
        </Typography>
        <Typography variant="body2" className="text-slate-400 max-w-xl mx-auto leading-relaxed">
          Every analysis runs through three specialised AI engines in sequence — retrieval, reasoning, and generation — to produce grounded, accurate QA output.
        </Typography>
      </Box>

      {/* Flow */}
      <Box className="relative">
        {/* Connecting dashes (desktop) */}
        <Box className="hidden lg:flex absolute top-[72px] left-0 right-0 items-center justify-center px-24 pointer-events-none">
          {[0, 1].map((i) => (
            <Box key={i} className="flex-1 flex items-center justify-center mx-4">
              <Box className="flex items-center gap-1">
                {Array.from({ length: 8 }).map((_, d) => (
                  <Box
                    key={d}
                    className="w-2 h-0.5 rounded-full"
                    style={{
                      backgroundColor: "#c7d2fe",
                      opacity: 0.4 + d * 0.07,
                    }}
                  />
                ))}
                <Box className="w-0 h-0 border-t-4 border-b-4 border-l-6 border-t-transparent border-b-transparent"
                  style={{ borderLeftColor: "#818cf8", borderLeftWidth: 8, borderTopWidth: 4, borderBottomWidth: 4 }}
                />
              </Box>
            </Box>
          ))}
        </Box>

        <Box className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {brains.map((b, i) => {
            const Icon = b.icon;
            return (
              <Box
                key={b.name}
                className="relative bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300"
                style={{ borderColor: b.border }}
              >
                {/* Top gradient bar */}
                <Box className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${b.from}, ${b.to})` }} />

                <Box className="p-6">
                  {/* Step badge */}
                  <Box className="flex items-center justify-between mb-4">
                    <Box
                      className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${b.from}, ${b.to})` }}
                    >
                      <Icon sx={{ fontSize: 24, color: "white" }} />
                    </Box>
                    <Box
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: b.soft, color: b.text, border: `1px solid ${b.border}` }}
                    >
                      {b.tagline}
                    </Box>
                  </Box>

                  <Typography variant="body1" className="font-bold text-slate-900 mb-2">
                    {b.name}
                  </Typography>
                  <Typography variant="body2" className="text-slate-500 leading-relaxed mb-4 text-sm">
                    {b.desc}
                  </Typography>

                  {/* Tech stack */}
                  <Box className="flex flex-wrap gap-1.5">
                    {b.tech.map((t) => (
                      <span
                        key={t}
                        className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                        style={{ backgroundColor: b.soft, color: b.text }}
                      >
                        {t}
                      </span>
                    ))}
                  </Box>
                </Box>

                {/* Step number watermark */}
                <Box
                  className="absolute bottom-4 right-5 text-7xl font-black leading-none select-none pointer-events-none"
                  style={{ color: b.from + "10" }}
                >
                  {i + 1}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Pipeline flow strip */}
      <Box className="mt-6 bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm overflow-x-auto">
        <Box className="flex items-center gap-0 min-w-max mx-auto w-fit">
          {[
            { icon: FolderOpenIcon,       label: "Documents",      color: "#64748b", bg: "#f8fafc" },
            null,
            { icon: ManageSearchIcon,     label: "RAG Retrieval",  color: "#4f46e5", bg: "#eef2ff" },
            null,
            { icon: HubIcon,              label: "Graph Analysis", color: "#0ea5e9", bg: "#e0f2fe" },
            null,
            { icon: PsychologyIcon,       label: "LLM Generation", color: "#10b981", bg: "#ecfdf5" },
            null,
            { icon: AssignmentTurnedInIcon, label: "Test Plan",    color: "#8b5cf6", bg: "#f5f3ff" },
          ].map((item, i) => {
            if (!item) return (
              <Box key={i} className="flex items-center gap-0.5 px-2">
                {[0,1,2,3].map((d) => (
                  <Box key={d} className="w-1.5 h-1.5 rounded-full bg-slate-200" style={{ opacity: 0.4 + d * 0.15 }} />
                ))}
                <Box className="w-0 h-0" style={{
                  borderTop: "5px solid transparent", borderBottom: "5px solid transparent",
                  borderLeft: "6px solid #cbd5e1",
                }} />
              </Box>
            );
            const Icon = item.icon;
            return (
              <Box key={i} className="flex flex-col items-center gap-1.5">
                <Box
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: item.bg }}
                >
                  <Icon sx={{ fontSize: 18, color: item.color }} />
                </Box>
                <Typography variant="caption" className="text-slate-500 text-[10px] font-medium whitespace-nowrap">
                  {item.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

// ── AI Capabilities grid ──────────────────────────────────────────────────────
function CapabilitiesSection() {
  const caps = [
    { icon: BiotechIcon,          label: "Functional Scenarios",    desc: "Generates boundary, equivalence, state-transition, and pairwise test cases.",     color: "#4f46e5", bg: "#eef2ff" },
    { icon: GppGoodIcon,          label: "Gherkin Test Cases",       desc: "Produces Given/When/Then BDD scenarios with feature tags for automation.",         color: "#10b981", bg: "#ecfdf5" },
    { icon: AccountTreeIcon,      label: "Event Flow Tracing",       desc: "Maps end-to-end flows across UI, API, DB, Event, and Notification layers.",        color: "#0ea5e9", bg: "#e0f2fe" },
    { icon: BugReportIcon,        label: "Risk Intelligence",        desc: "Scores risk areas using historical bugs, dependency depth, and complexity.",        color: "#ef4444", bg: "#fef2f2" },
    { icon: FindInPageIcon,       label: "Coverage Gap Detection",   desc: "Identifies untested paths and recommends areas needing additional coverage.",       color: "#8b5cf6", bg: "#f5f3ff" },
    { icon: ApiIcon,              label: "API & Event Validation",   desc: "Validates REST endpoints, payloads, and event triggers against the test story.",    color: "#f59e0b", bg: "#fffbeb" },
    { icon: AutoFixHighIcon,      label: "Regression Suite",         desc: "Prioritises MUST-RUN and SHOULD-RUN test cases for each release cycle.",           color: "#ec4899", bg: "#fdf2f8" },
    { icon: InsightsIcon,         label: "Feature Intelligence",     desc: "Detects whether a feature is new, existing, or partially known in your codebase.", color: "#06b6d4", bg: "#ecfeff" },
  ];

  return (
    <Box className="mt-14 mb-4">
      <Box className="text-center mb-8">
        <Box className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 mb-3">
          <AutoAwesomeIcon sx={{ fontSize: 14, color: "#10b981" }} />
          <Typography variant="caption" className="text-emerald-600 font-semibold text-[11px] uppercase tracking-widest">
            AI Capabilities
          </Typography>
        </Box>
        <Typography variant="h5" className="font-bold text-slate-900 mb-2">
          What QA Intelligence generates
        </Typography>
        <Typography variant="body2" className="text-slate-400 max-w-lg mx-auto leading-relaxed">
          One user story in — a complete, multi-section QA test plan out.
        </Typography>
      </Box>

      <Box className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {caps.map(({ icon: Icon, label, desc, color, bg }, i) => (
          <Box
            key={label}
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 card-appear"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <Box
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ backgroundColor: bg }}
            >
              <Icon sx={{ fontSize: 18, color }} />
            </Box>
            <Typography variant="body2" className="font-bold text-slate-800 mb-1 leading-tight">
              {label}
            </Typography>
            <Typography variant="caption" className="text-slate-400 leading-relaxed text-[12px]">
              {desc}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Hero vector art (inline SVG illustration) ─────────────────────────────────
function HeroVectorArt() {
  return (
    <svg viewBox="0 0 380 280" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id="hg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hg2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hg3" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ── Background glow ellipses ── */}
      <ellipse cx="190" cy="140" rx="140" ry="100" fill="url(#hg1)" />

      {/* ── Dot grid ── */}
      {Array.from({ length: 8 }).map((_, r) =>
        Array.from({ length: 11 }).map((_, c) => (
          <circle key={`d-${r}-${c}`} cx={c * 38 + 14} cy={r * 36 + 14} r="1.3" fill="white" fillOpacity="0.09" />
        ))
      )}

      {/* ── Curved connector arcs ── */}
      <path d="M190,140 Q120,100 72,72" stroke="white" strokeOpacity="0.13" strokeWidth="1.5" strokeDasharray="5 4" fill="none" />
      <path d="M190,140 Q260,100 308,72" stroke="white" strokeOpacity="0.13" strokeWidth="1.5" strokeDasharray="5 4" fill="none" />
      <path d="M190,140 Q190,195 190,228" stroke="white" strokeOpacity="0.13" strokeWidth="1.5" strokeDasharray="5 4" fill="none" />
      <path d="M190,140 Q110,150 50,150" stroke="white" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="3 3" fill="none" />
      <path d="M190,140 Q270,150 330,150" stroke="white" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="3 3" fill="none" />

      {/* ── Animated pulse rings on center ── */}
      <circle cx="190" cy="140" r="60" stroke="white" strokeOpacity="0.05" strokeWidth="1" fill="none" />
      <circle cx="190" cy="140" r="80" stroke="white" strokeOpacity="0.04" strokeWidth="1" fill="none" />

      {/* ── Center hub ── */}
      <circle cx="190" cy="140" r="46" fill="white" fillOpacity="0.07" />
      <circle cx="190" cy="140" r="36" fill="white" fillOpacity="0.08" />
      <circle cx="190" cy="140" r="26" fill="white" fillOpacity="0.12" />
      {/* Brain silhouette */}
      <path
        d="M178,132 C175,125 167,124 165,130 C162,136 166,142 172,143 C171,147 173,152 178,151 L178,158 L202,158 L202,151 C207,152 209,147 208,143 C214,142 218,136 215,130 C213,124 205,125 202,132 C200,128 196,126 190,126 C184,126 180,128 178,132 Z"
        fill="white" fillOpacity="0.65"
      />
      <text x="190" y="168" textAnchor="middle" fill="white" fillOpacity="0.55" fontSize="8" fontFamily="system-ui, sans-serif" fontWeight="700" letterSpacing="1">3-BRAIN</text>

      {/* ── RAG Node top-left ── */}
      <circle cx="72" cy="72" r="32" fill="url(#hg1)" />
      <circle cx="72" cy="72" r="24" fill="white" fillOpacity="0.08" />
      <circle cx="72" cy="72" r="16" fill="white" fillOpacity="0.09" />
      <circle cx="70" cy="69" r="8" stroke="white" strokeOpacity="0.65" strokeWidth="2" fill="none" />
      <line x1="75.5" y1="74.5" x2="80" y2="79" stroke="white" strokeOpacity="0.65" strokeWidth="2" strokeLinecap="round" />
      <text x="72" y="107" textAnchor="middle" fill="white" fillOpacity="0.45" fontSize="8.5" fontFamily="system-ui" fontWeight="700">RAG</text>

      {/* ── Graph Node top-right ── */}
      <circle cx="308" cy="72" r="32" fill="url(#hg2)" />
      <circle cx="308" cy="72" r="24" fill="white" fillOpacity="0.08" />
      <circle cx="308" cy="72" r="16" fill="white" fillOpacity="0.09" />
      <circle cx="308" cy="69" r="5" fill="white" fillOpacity="0.7" />
      <circle cx="296" cy="78" r="3.5" fill="white" fillOpacity="0.45" />
      <circle cx="320" cy="78" r="3.5" fill="white" fillOpacity="0.45" />
      <circle cx="299" cy="61" r="3.5" fill="white" fillOpacity="0.45" />
      <circle cx="317" cy="61" r="3.5" fill="white" fillOpacity="0.45" />
      <line x1="308" y1="69" x2="296" y2="78" stroke="white" strokeOpacity="0.35" strokeWidth="1.2" />
      <line x1="308" y1="69" x2="320" y2="78" stroke="white" strokeOpacity="0.35" strokeWidth="1.2" />
      <line x1="308" y1="69" x2="299" y2="61" stroke="white" strokeOpacity="0.35" strokeWidth="1.2" />
      <line x1="308" y1="69" x2="317" y2="61" stroke="white" strokeOpacity="0.35" strokeWidth="1.2" />
      <text x="308" y="107" textAnchor="middle" fill="white" fillOpacity="0.45" fontSize="8.5" fontFamily="system-ui" fontWeight="700">GRAPH</text>

      {/* ── LLM Node bottom ── */}
      <circle cx="190" cy="228" r="32" fill="url(#hg3)" />
      <circle cx="190" cy="228" r="24" fill="white" fillOpacity="0.08" />
      <circle cx="190" cy="228" r="16" fill="white" fillOpacity="0.09" />
      <path d="M190,216 L192.5,223 L200,225.5 L192.5,228 L190,235 L187.5,228 L180,225.5 L187.5,223 Z" fill="white" fillOpacity="0.7" />
      <text x="190" y="262" textAnchor="middle" fill="white" fillOpacity="0.45" fontSize="8.5" fontFamily="system-ui" fontWeight="700">LLM</text>

      {/* ── Docs node left ── */}
      <circle cx="50" cy="150" r="22" fill="white" fillOpacity="0.05" />
      <rect x="40" y="139" width="20" height="24" rx="2.5" fill="white" fillOpacity="0.1" stroke="white" strokeOpacity="0.25" strokeWidth="1" />
      <line x1="44" y1="145" x2="56" y2="145" stroke="white" strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="44" y1="149" x2="56" y2="149" stroke="white" strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="44" y1="153" x2="52" y2="153" stroke="white" strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" />
      <text x="50" y="178" textAnchor="middle" fill="white" fillOpacity="0.35" fontSize="8" fontFamily="system-ui" fontWeight="600">DOCS</text>

      {/* ── Test plan node right ── */}
      <circle cx="330" cy="150" r="22" fill="white" fillOpacity="0.05" />
      <rect x="320" y="139" width="20" height="24" rx="2.5" fill="white" fillOpacity="0.1" stroke="white" strokeOpacity="0.25" strokeWidth="1" />
      <path d="M324,145 L326,147 L330,143" stroke="white" strokeOpacity="0.65" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="333" y1="145" x2="338" y2="145" stroke="white" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round" />
      <path d="M324,150 L326,152 L330,148" stroke="white" strokeOpacity="0.65" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="333" y1="150" x2="338" y2="150" stroke="white" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round" />
      <path d="M324,155 L326,157 L330,153" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="333" y1="155" x2="338" y2="155" stroke="white" strokeOpacity="0.25" strokeWidth="1" strokeLinecap="round" />
      <text x="330" y="178" textAnchor="middle" fill="white" fillOpacity="0.35" fontSize="8" fontFamily="system-ui" fontWeight="600">TESTS</text>

      {/* ── Floating accent dots ── */}
      <circle cx="148" cy="100" r="3.5" fill="white" fillOpacity="0.18" />
      <circle cx="235" cy="95" r="2.5" fill="white" fillOpacity="0.14" />
      <circle cx="142" cy="178" r="3" fill="white" fillOpacity="0.15" />
      <circle cx="232" cy="182" r="3.5" fill="white" fillOpacity="0.12" />
      <circle cx="165" cy="195" r="2" fill="white" fillOpacity="0.1" />
      <circle cx="210" cy="96" r="2" fill="white" fillOpacity="0.1" />

      {/* ── Small ring accents ── */}
      <circle cx="148" cy="100" r="7" stroke="white" strokeOpacity="0.08" strokeWidth="1" fill="none" />
      <circle cx="232" cy="182" r="8" stroke="white" strokeOpacity="0.07" strokeWidth="1" fill="none" />
    </svg>
  );
}

// ── Hero card ─────────────────────────────────────────────────────────────────
function HeroCard({ onCreateProject }: { onCreateProject: () => void }) {
  const features = [
    { emoji: "🧠", label: "3 AI Brains" },
    { emoji: "📋", label: "8 Output Types" },
    { emoji: "📄", label: "6 Doc Formats" },
    { emoji: "⚡", label: "Real-time" },
  ];

  return (
    <Box
      className="relative overflow-hidden rounded-3xl mb-10"
      style={{
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 35%, #4338ca 65%, #4f46e5 100%)",
        boxShadow: "0 32px 64px -16px rgba(79,70,229,0.45), 0 0 0 1px rgba(99,102,241,0.2)",
      }}
    >
      {/* Background SVG decoration */}
      <Box className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 1200 340" preserveAspectRatio="xMidYMid slice" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="980" cy="-60" r="320" fill="white" fillOpacity="0.025" />
          <circle cx="820" cy="380" r="260" fill="white" fillOpacity="0.02" />
          <circle cx="100" cy="300" r="180" fill="white" fillOpacity="0.015" />
          <line x1="550" y1="0" x2="850" y2="340" stroke="white" strokeOpacity="0.035" strokeWidth="1.5" />
          <line x1="650" y1="0" x2="950" y2="340" stroke="white" strokeOpacity="0.03" strokeWidth="1" />
          <line x1="750" y1="0" x2="1050" y2="340" stroke="white" strokeOpacity="0.025" strokeWidth="1" />
          <path d="M 1050 -80 Q 1150 170 990 420" stroke="white" strokeOpacity="0.05" strokeWidth="2" fill="none" />
          <path d="M 0 100 Q 80 170 0 240" stroke="white" strokeOpacity="0.04" strokeWidth="2" fill="none" />
        </svg>
      </Box>

      <Box
        sx={{
          position: "relative",
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          alignItems: "center",
          gap: 3,
          px: 4,
          py: { xs: 5, lg: 4 },
        }}
      >
        {/* ── Left: text ── */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Badge */}
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              px: "14px",
              py: "6px",
              borderRadius: 999,
              mb: "20px",
              backgroundColor: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <ElectricBoltIcon sx={{ fontSize: 13, color: "#a5b4fc" }} />
            <Typography
              variant="caption"
              sx={{ color: "#c7d2fe", fontWeight: 700, fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase" }}
            >
              AI-Powered · Three-Brain Architecture
            </Typography>
          </Box>

          {/* Headline */}
          <Typography
            variant="h3"
            sx={{ fontWeight: 900, lineHeight: 1.12, mb: 2, color: "white", fontSize: "clamp(1.75rem, 3vw, 2.4rem)" }}
          >
            QA Intelligence,{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #a5b4fc, #67e8f9)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Automated.
            </span>
          </Typography>

          <Typography
            variant="body1"
            sx={{ lineHeight: 1.7, mb: 3.5, color: "rgba(255,255,255,0.62)", maxWidth: 460, fontSize: 15 }}
          >
            Ingest BRDs, SRS docs, bug reports &amp; API contracts. Get structured
            test scenarios, Gherkin cases, event flow maps, and risk intelligence —
            powered by RAG, Graph AI, and LLM in seconds.
          </Typography>

          {/* CTA row */}
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", mb: 4 }}>
            <button
              onClick={onCreateProject}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 24px",
                borderRadius: "12px",
                fontWeight: 700,
                fontSize: 14,
                backgroundColor: "white",
                color: "#4338ca",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 8px 28px rgba(0,0,0,0.28)",
                transition: "transform 0.15s",
              }}
            >
              <AddIcon sx={{ fontSize: 17 }} />
              Start a Project
            </button>
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px", fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.45)" }}>
              <AutoAwesomeIcon sx={{ fontSize: 14 }} />
              No setup required
            </Box>
          </Box>

          {/* Feature pills */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {features.map((f) => (
              <Box
                key={f.label}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  px: "12px",
                  py: "6px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  backgroundColor: "rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.68)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <span>{f.emoji}</span>
                <span>{f.label}</span>
              </Box>
            ))}
          </Box>
        </Box>

        {/* ── Right: vector art ── */}
        <Box
          sx={{
            flexShrink: 0,
            display: { xs: "none", lg: "flex" },
            alignItems: "center",
            justifyContent: "center",
            width: 340,
            height: 240,
          }}
        >
          <HeroVectorArt />
        </Box>
      </Box>

      {/* Bottom accent strip */}
      <Box
        className="h-0.5 w-full"
        style={{ background: "linear-gradient(90deg, transparent, rgba(165,180,252,0.4), rgba(103,232,249,0.4), transparent)" }}
      />
    </Box>
  );
}

// ── New project dialog ────────────────────────────────────────────────────────
function NewProjectDialog({ open, onClose, onCreate }: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, desc: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name.trim(), desc.trim());
    setSaving(false);
    setName("");
    setDesc("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, boxShadow: "0 25px 60px -12px rgb(0 0 0 / 0.25)" } } }}
    >
      <DialogTitle sx={{ pb: 0.5 }}>
        <Box className="flex items-center gap-3 mb-1">
          <Box className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
            <AddIcon sx={{ fontSize: 18, color: "white" }} />
          </Box>
          <Box>
            <Typography variant="h6" className="font-bold text-slate-900 leading-tight">
              New Project
            </Typography>
            <Typography variant="caption" className="text-slate-400">
              Create a QA workspace
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: "16px !important" }}>
        <Box className="space-y-4">
          <Box>
            <Typography variant="caption" className="text-slate-600 font-semibold block mb-1.5">
              Project Name <span style={{ color: "#ef4444" }}>*</span>
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. HKM Payment System"
              autoFocus
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#4f46e5" },
                },
              }}
            />
          </Box>
          <Box>
            <Typography variant="caption" className="text-slate-600 font-semibold block mb-1.5">
              Description{" "}
              <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span>
            </Typography>
            <TextField
              fullWidth
              size="small"
              multiline
              rows={2}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What will this project cover?"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#4f46e5" },
                },
              }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: "#64748b", borderRadius: 2 }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!name.trim() || saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: 15 }} />}
          sx={{
            bgcolor: "#4f46e5",
            "&:hover": { bgcolor: "#4338ca" },
            "&.Mui-disabled": { bgcolor: "#e2e8f0", color: "#94a3b8" },
            borderRadius: 2,
            px: 3,
            fontWeight: 600,
            boxShadow: "0 4px 12px rgb(79 70 229 / 0.3)",
          }}
        >
          {saving ? "Creating…" : "Create Project"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listProjects();
      setProjects(res.projects);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (name: string, desc: string) => {
    const p = await createProject(name, desc);
    setProjects((prev) => [{ ...p, chunks: 0, file_count: 0 }, ...prev]);
  };

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .card-appear {
          animation: fadeUp 0.35s ease both;
        }
      `}</style>

      <div
        className="min-h-screen"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, #eef2ff 0%, #f1f5f9 60%)",
        }}
      >
        {/* Top nav */}
        <Box className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10">
          <Box className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Box className="flex items-center gap-3">
              <Box className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <BoltIcon sx={{ fontSize: 19, color: "white" }} />
              </Box>
              <Box>
                <Typography variant="body1" className="font-bold text-slate-900 leading-tight">
                  QA Intelligence
                </Typography>
                <Typography variant="caption" className="text-slate-400 text-[11px]">
                  Three-Brain Architecture
                </Typography>
              </Box>
            </Box>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-500 transition-all shadow-md shadow-indigo-200 active:scale-95"
            >
              <AddIcon sx={{ fontSize: 16 }} />
              New Project
            </button>
          </Box>
        </Box>

        {/* Content */}
        <Box className="max-w-6xl mx-auto px-6 py-10">

          {/* Hero card */}
          <HeroCard onCreateProject={() => setDialogOpen(true)} />

          {/* Section heading */}
          <Box className="mb-6 flex items-center justify-between">
            <Box className="flex items-center gap-2">
              <Box className="w-1 h-5 rounded-full bg-indigo-500" />
              <Typography variant="body1" className="font-bold text-slate-800">
                Projects
              </Typography>
            </Box>
          </Box>

          {/* Stats bar */}
          {projects.length > 0 && <StatsBar projects={projects} />}

          {/* Grid */}
          {loading ? (
            <Box className="flex items-center justify-center py-28">
              <Box className="flex flex-col items-center gap-3">
                <CircularProgress sx={{ color: "#4f46e5" }} />
                <Typography variant="caption" className="text-slate-400">
                  Loading projects…
                </Typography>
              </Box>
            </Box>
          ) : projects.length === 0 ? (
            <EmptyState onCreate={() => setDialogOpen(true)} />
          ) : (
            <Box className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p, i) => (
                <Box
                  key={p.id}
                  className="card-appear"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <ProjectCard
                    project={p}
                    index={i}
                    onOpen={() => router.push(`/projects/${p.id}`)}
                    onDelete={() => handleDelete(p.id)}
                  />
                </Box>
              ))}

              {/* Add new card */}
              <button
                onClick={() => setDialogOpen(true)}
                className="bg-white/60 border-2 border-dashed border-slate-300 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all min-h-[220px] group"
              >
                <Box className="w-12 h-12 rounded-2xl border-2 border-dashed border-slate-300 group-hover:border-indigo-400 flex items-center justify-center transition-colors">
                  <AddIcon sx={{ fontSize: 22 }} />
                </Box>
                <Typography variant="body2" className="font-semibold">
                  New Project
                </Typography>
              </button>
            </Box>
          )}

          {/* Three-Brain Architecture & Capabilities */}
          <PipelineSection />
          <CapabilitiesSection />
        </Box>
      </div>

      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
      />
    </>
  );
}
