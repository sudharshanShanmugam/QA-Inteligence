"use client";

import { useState, useCallback, useRef } from "react";
import { Box, Typography, CircularProgress, LinearProgress } from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ReportIcon from "@mui/icons-material/Report";
import BlockIcon from "@mui/icons-material/Block";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ArticleIcon from "@mui/icons-material/Article";
import BugReportIcon from "@mui/icons-material/BugReport";
import ApiIcon from "@mui/icons-material/Api";
import StorageIcon from "@mui/icons-material/Storage";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import PersonIcon from "@mui/icons-material/Person";
import DescriptionIcon from "@mui/icons-material/Description";
import HubIcon from "@mui/icons-material/Hub";
import NorthIcon from "@mui/icons-material/North";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import { ingestProjectFiles, IngestFileResult } from "@/lib/api";

const DOC_TYPES = [
  { value: "auto",         Icon: AutoAwesomeIcon,        label: "Auto-detect",  color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
  { value: "brd",          Icon: DescriptionIcon,         label: "BRD",          color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" },
  { value: "srs",          Icon: ArticleIcon,             label: "SRS",          color: "#0ea5e9", bg: "#e0f2fe", border: "#bae6fd" },
  { value: "user_story",   Icon: PersonIcon,              label: "User Story",   color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0" },
  { value: "bug_report",   Icon: BugReportIcon,           label: "Bug Report",   color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
  { value: "api_contract", Icon: ApiIcon,                 label: "API Contract", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  { value: "db_schema",    Icon: StorageIcon,             label: "DB Schema",    color: "#06b6d4", bg: "#ecfeff", border: "#a5f3fc" },
  { value: "test_case",    Icon: AssignmentTurnedInIcon,  label: "Test Cases",   color: "#ec4899", bg: "#fdf2f8", border: "#fbcfe8" },
];

const STATUS_CFG = {
  OK:       { Icon: CheckCircleOutlinedIcon, color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0", label: "Ingested"   },
  REJECTED: { Icon: BlockIcon,               color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", label: "Rejected"   },
  FAIL:     { Icon: ReportIcon,              color: "#ef4444", bg: "#fef2f2", border: "#fecaca", label: "Failed"     },
  PENDING:  { Icon: CircularProgress as any, color: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0", label: "Processing" },
} as const;

// ── Upload illustration ───────────────────────────────────────────────────────
function UploadArt({ active, selectedColor }: { active: boolean; selectedColor: string }) {
  const c = active ? selectedColor : "#94a3b8";
  const soft = active ? selectedColor + "18" : "#f1f5f9";
  return (
    <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 320, height: 200, maxWidth: "100%" }}>
      <defs>
        <radialGradient id="ua-glow" cx="50%" cy="60%" r="45%">
          <stop offset="0%" stopColor={active ? selectedColor : "#e2e8f0"} stopOpacity="0.25" />
          <stop offset="100%" stopColor={active ? selectedColor : "#e2e8f0"} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Glow base */}
      <ellipse cx="160" cy="130" rx="130" ry="70" fill="url(#ua-glow)" />

      {/* Left floating doc */}
      <g opacity={active ? 0.9 : 0.5} transform="rotate(-8 80 90) translate(-10 0)">
        <rect x="44" y="50" width="62" height="78" rx="8" fill="white" stroke={active ? selectedColor + "60" : "#e2e8f0"} strokeWidth="1.5" />
        <rect x="44" y="50" width="62" height="18" rx="8" fill={active ? selectedColor + "30" : "#f1f5f9"} />
        <rect x="44" y="60" width="62" height="8" rx="0" fill={active ? selectedColor + "30" : "#f1f5f9"} />
        <rect x="52" y="77" width="46" height="4" rx="2" fill={active ? selectedColor + "25" : "#f1f5f9"} />
        <rect x="52" y="85" width="38" height="3.5" rx="1.5" fill="#f1f5f9" />
        <rect x="52" y="93" width="42" height="3.5" rx="1.5" fill="#f1f5f9" />
        <rect x="52" y="101" width="30" height="3.5" rx="1.5" fill="#f1f5f9" />
        <text x="75" y="63" textAnchor="middle" fill={active ? selectedColor : "#94a3b8"} fontSize="6" fontFamily="system-ui" fontWeight="800">DOC</text>
      </g>

      {/* Right floating doc */}
      <g opacity={active ? 0.9 : 0.5} transform="rotate(9 240 85) translate(10 -5)">
        <rect x="212" y="44" width="60" height="76" rx="8" fill="white" stroke={active ? selectedColor + "60" : "#e2e8f0"} strokeWidth="1.5" />
        <rect x="212" y="44" width="60" height="17" rx="8" fill={active ? selectedColor + "25" : "#f1f5f9"} />
        <rect x="212" y="53" width="60" height="8" rx="0" fill={active ? selectedColor + "25" : "#f1f5f9"} />
        <rect x="220" y="70" width="44" height="4" rx="2" fill={active ? selectedColor + "20" : "#f1f5f9"} />
        <rect x="220" y="78" width="36" height="3.5" rx="1.5" fill="#f1f5f9" />
        <rect x="220" y="86" width="40" height="3.5" rx="1.5" fill="#f1f5f9" />
        <rect x="220" y="94" width="28" height="3.5" rx="1.5" fill="#f1f5f9" />
        <text x="242" y="57" textAnchor="middle" fill={active ? selectedColor : "#94a3b8"} fontSize="6" fontFamily="system-ui" fontWeight="800">PDF</text>
      </g>

      {/* Rising dots / particles */}
      {active && [
        { x: 120, y: 110, r: 3.5, op: 0.7 },
        { x: 160, y: 95,  r: 2.5, op: 0.5 },
        { x: 195, y: 108, r: 3,   op: 0.6 },
        { x: 140, y: 80,  r: 2,   op: 0.4 },
        { x: 180, y: 82,  r: 2.5, op: 0.35 },
      ].map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={selectedColor} fillOpacity={d.op} />
      ))}

      {/* Central upload circle */}
      <circle cx="160" cy="125" r="42" fill={soft} stroke={active ? selectedColor + "50" : "#e2e8f0"} strokeWidth="1.5" />
      <circle cx="160" cy="125" r="32" fill="white" stroke={active ? selectedColor + "30" : "#f1f5f9"} strokeWidth="1.5" />

      {/* Upload arrow */}
      <path d="M160 113 L160 135" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M151 121 L160 113 L169 121" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M150 137 L170 137" stroke={c} strokeWidth="2.5" strokeLinecap="round" />

      {/* Small sparkles when active */}
      {active && <>
        <path d="M116 88 L117.5 91.5 L121 93 L117.5 94.5 L116 98 L114.5 94.5 L111 93 L114.5 91.5 Z" fill={selectedColor} fillOpacity="0.5" />
        <path d="M204 82 L205 84.5 L207.5 85.5 L205 86.5 L204 89 L203 86.5 L200.5 85.5 L203 84.5 Z" fill={selectedColor} fillOpacity="0.45" />
      </>}

      {/* Format badges at bottom */}
      {[
        { x: 40,  y: 178, label: "PDF"  },
        { x: 88,  y: 185, label: "DOCX" },
        { x: 138, y: 190, label: "XLSX" },
        { x: 186, y: 187, label: "JSON" },
        { x: 232, y: 180, label: "SQL"  },
      ].map((b) => (
        <g key={b.label}>
          <rect x={b.x - 2} y={b.y - 10} width={b.label.length * 5.5 + 8} height="13" rx="6.5" fill={active ? selectedColor + "12" : "#f8fafc"} stroke={active ? selectedColor + "40" : "#e2e8f0"} strokeWidth="1" />
          <text x={b.x + (b.label.length * 5.5 + 8) / 2 - 2} y={b.y - 1} textAnchor="middle" fill={active ? selectedColor : "#94a3b8"} fontSize="7" fontFamily="system-ui" fontWeight="700">{b.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface IngestTabProps {
  projectId: string;
  onIngestComplete?: () => void;
}

export default function IngestTab({ projectId, onIngestComplete }: IngestTabProps) {
  const [docType, setDocType] = useState("auto");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<IngestFileResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setLoading(true);

    // Seed results with PENDING entries so the user sees all files immediately
    const pending = files.map((f): IngestFileResult => ({
      file: f.name, type: docType, status: "PENDING", chunks: 0, entities: 0, rels: 0,
    }));
    setResults((prev) => [...pending, ...prev]);

    for (let i = 0; i < files.length; i++) {
      try {
        const res = await ingestProjectFiles(projectId, [files[i]], docType);
        const fileResult = res.results[0];
        setResults((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((r) => r.file === files[i].name && r.status === "PENDING");
          if (idx !== -1) updated[idx] = fileResult;
          return updated;
        });
      } catch (e: any) {
        setResults((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((r) => r.file === files[i].name && r.status === "PENDING");
          if (idx !== -1) updated[idx] = { file: files[i].name, type: docType, status: "FAIL", chunks: 0, entities: 0, rels: 0, error: e.message };
          return updated;
        });
      }
    }

    onIngestComplete?.();
    setLoading(false);
  }, [projectId, docType, onIngestComplete]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const selected = DOC_TYPES.find((d) => d.value === docType)!;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>

      {/* ── Page title ── */}
      <Box>
        <Typography sx={{ fontWeight: 800, fontSize: 22, color: "text.primary", lineHeight: 1.2 }}>
          Upload Documents
        </Typography>
        <Typography sx={{ color: "text.secondary", fontSize: 14, mt: 0.5 }}>
          Feed your project&apos;s knowledge base — BRDs, specs, bug reports, API contracts and more.
        </Typography>
      </Box>

      {/* ── Doc type selector row ── */}
      <Box>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1.5 }}>
          Document type
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {DOC_TYPES.map(({ value, Icon, label, color, bg, border }) => {
            const active = docType === value;
            return (
              <Box
                key={value}
                onClick={() => setDocType(value)}
                sx={{
                  display: "flex", alignItems: "center", gap: "7px",
                  px: "14px", py: "8px", borderRadius: "12px",
                  cursor: "pointer", transition: "all 0.15s",
                  bgcolor: active ? bg : "background.paper",
                  border: `1.5px solid`,
                  borderColor: active ? border : "divider",
                  boxShadow: active ? `0 0 0 3px ${color}18` : "none",
                  "&:hover": { borderColor: active ? border : color + "60", bgcolor: active ? bg : color + "08" },
                }}
              >
                <Icon sx={{ fontSize: 15, color: active ? color : "text.disabled" }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: active ? 700 : 500, color: active ? color : "text.secondary", whiteSpace: "nowrap" }}>
                  {label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* ── Drop zone ── */}
      <Box
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        sx={{
          borderRadius: "24px",
          border: dragging ? `2px solid ${selected.color}` : "2px dashed",
          borderColor: dragging ? selected.color : "divider",
          bgcolor: dragging ? `${selected.color}06` : "background.paper",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 1.5, py: 5, px: 4,
          cursor: "pointer", transition: "all 0.2s",
          boxShadow: dragging ? `0 0 0 5px ${selected.color}14` : "0 1px 4px rgba(0,0,0,0.04)",
          "&:hover": {
            borderColor: selected.color + "80",
            bgcolor: selected.color + "04",
          },
          position: "relative", overflow: "hidden",
        }}
      >
        {/* Dot grid background */}
        <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5 }}>
          <svg width="100%" height="100%">
            <defs>
              <pattern id="itdots" x="0" y="0" width="26" height="26" patternUnits="userSpaceOnUse">
                <circle cx="1.3" cy="1.3" r="1" fill={dragging ? selected.color : "#94a3b8"} fillOpacity={dragging ? 0.25 : 0.4} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#itdots)" />
          </svg>
        </Box>

        <Box sx={{ position: "relative" }}>
          <UploadArt active={dragging} selectedColor={selected.color} />
        </Box>

        <Box sx={{ textAlign: "center", position: "relative" }}>
          <Typography sx={{
            fontSize: 17, fontWeight: 700,
            color: dragging ? selected.color : "text.primary",
            mb: 0.5, transition: "color 0.2s",
          }}>
            {dragging ? `Drop to ingest as ${selected.label}` : "Drop files here to upload"}
          </Typography>
          <Typography sx={{ fontSize: 13, color: "text.disabled" }}>
            or{" "}
            <span style={{ color: selected.color, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>
              browse your computer
            </span>
          </Typography>
        </Box>

        {/* Selected type badge */}
        <Box sx={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          px: "14px", py: "6px", borderRadius: "999px",
          bgcolor: selected.bg, border: `1px solid ${selected.border}`,
          position: "relative", mt: 0.5,
        }}>
          <selected.Icon sx={{ fontSize: 13, color: selected.color }} />
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: selected.color }}>
            {selected.label}
          </Typography>
        </Box>

        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          accept=".pdf,.docx,.txt,.json,.md,.yaml,.yml,.sql,.xlsx,.xls"
          onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
        />
      </Box>

      {/* ── Processing ── */}
      {loading && (() => {
        const pendingCount = results.filter(r => r.status === "PENDING").length;
        const doneCount = results.filter(r => r.status !== "PENDING").length;
        const total = pendingCount + doneCount;
        const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;
        return (
          <Box sx={{
            bgcolor: "background.paper",
            border: "1px solid", borderColor: "primary.main" + "30",
            borderRadius: "16px", px: 3, py: 2.5, overflow: "hidden",
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1.5 }}>
              <CircularProgress size={18} sx={{ color: "primary.main", flexShrink: 0 }} />
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: "primary.main" }}>
                Processing {pendingCount > 0 ? `${doneCount} / ${total} files` : "documents"}…
              </Typography>
              <Box sx={{ ml: "auto", display: "flex", gap: 1.5 }}>
                {["Extracting", "Embedding", "Graph"].map((s, i) => (
                  <Box key={s} sx={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Box sx={{
                      width: 5, height: 5, borderRadius: "50%", bgcolor: "primary.main",
                      animation: "pulseDot 1s infinite", animationDelay: `${i * 0.22}s`,
                      "@keyframes pulseDot": { "0%,100%": { opacity: 0.25, transform: "scale(0.7)" }, "50%": { opacity: 1, transform: "scale(1)" } },
                    }} />
                    <Typography sx={{ fontSize: 11, color: "primary.main", fontWeight: 500 }}>{s}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                borderRadius: 2, height: 4,
                bgcolor: "primary.main" + "18",
                "& .MuiLinearProgress-bar": { background: "linear-gradient(90deg, #6366f1, #818cf8)", borderRadius: 2, transition: "transform 0.4s ease" },
              }}
            />
            <Typography sx={{ fontSize: 11, color: "primary.main", mt: 0.75, textAlign: "right" }}>{progress}%</Typography>
          </Box>
        );
      })()}

      {/* ── Results ── */}
      {results.length > 0 && (
        <Box>
          {/* Section label */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <Box sx={{ width: 3, height: 18, borderRadius: 2, bgcolor: "primary.main" }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Uploaded Files
            </Typography>
            <Box sx={{ px: "9px", py: "2px", borderRadius: "999px", bgcolor: "primary.main" + "12", border: "1px solid", borderColor: "primary.main" + "30" }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: "primary.main" }}>{results.length}</Typography>
            </Box>
          </Box>

          {/* File rows */}
          <Box sx={{
            bgcolor: "background.paper",
            border: "1px solid", borderColor: "divider",
            borderRadius: "20px", overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}>
            {results.map((r, i) => {
              const cfg = STATUS_CFG[r.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.PENDING;
              const dt = DOC_TYPES.find((d) => d.value === r.detected_type) ?? DOC_TYPES[0];
              return (
                <Box
                  key={i}
                  sx={{
                    display: "flex", alignItems: "center", gap: 2,
                    px: 3, py: 2,
                    borderBottom: i < results.length - 1 ? "1px solid" : "none",
                    borderBottomColor: "divider",
                    animation: "rowIn 0.28s ease both",
                    animationDelay: `${i * 40}ms`,
                    "@keyframes rowIn": { from: { opacity: 0, transform: "translateX(-8px)" }, to: { opacity: 1, transform: "translateX(0)" } },
                    "&:hover": { bgcolor: "background.default" },
                    transition: "background 0.15s",
                  }}
                >
                  {/* File icon */}
                  <Box sx={{
                    width: 38, height: 38, borderRadius: "10px", flexShrink: 0,
                    bgcolor: dt.bg, border: `1px solid ${dt.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <InsertDriveFileIcon sx={{ fontSize: 18, color: dt.color }} />
                  </Box>

                  {/* Name + type */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: "text.primary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.file}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.3 }}>
                      {r.detected_type && (
                        <Typography sx={{ fontSize: 11, color: "text.disabled" }}>{dt.label}</Typography>
                      )}
                      {r.reason && (
                        <Typography sx={{ fontSize: 11, color: "#b45309" }}>· {r.reason}</Typography>
                      )}
                      {r.error && (
                        <Typography sx={{ fontSize: 11, color: "#b91c1c" }}>· {r.error}</Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Chunks + entities */}
                  {r.status === "OK" && (
                    <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: "4px", px: "9px", py: "3px", borderRadius: "8px", bgcolor: "#eef2ff" }}>
                        <HubIcon sx={{ fontSize: 11, color: "#6366f1" }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#4338ca" }}>{r.chunks}</Typography>
                      </Box>
                      {r.entities > 0 && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: "4px", px: "9px", py: "3px", borderRadius: "8px", bgcolor: "#ecfdf5" }}>
                          <NorthIcon sx={{ fontSize: 10, color: "#10b981" }} />
                          <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#065f46" }}>{r.entities}</Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Status badge */}
                  <Box sx={{
                    display: "flex", alignItems: "center", gap: "5px",
                    px: "10px", py: "4px", borderRadius: "999px",
                    bgcolor: cfg.bg, border: `1px solid ${cfg.border}`, flexShrink: 0,
                  }}>
                    {r.status === "PENDING"
                      ? <CircularProgress size={10} sx={{ color: cfg.color }} />
                      : <cfg.Icon sx={{ fontSize: 12, color: cfg.color }} />
                    }
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{cfg.label}</Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
}
