"use client";

import { useEffect, useState, useCallback } from "react";
import { Box, Typography, CircularProgress, Tooltip, IconButton } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import BoltIcon from "@mui/icons-material/Bolt";
import StorageIcon from "@mui/icons-material/Storage";
import HubIcon from "@mui/icons-material/Hub";
import DeleteIcon from "@mui/icons-material/Delete";
import TuneIcon from "@mui/icons-material/Tune";
import {
  getSettings, getProjectKBStatus, clearProjectKB, resetUsage,
  AppSettings, KBStatus,
} from "@/lib/api";

interface SidebarProps {
  projectId: string;
  onKBChange?: () => void;
  refreshKey?: number;
}

export default function Sidebar({ projectId, onKBChange, refreshKey = 0 }: SidebarProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [kb, setKb] = useState<KBStatus | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    const [s, k] = await Promise.all([getSettings(), getProjectKBStatus(projectId)]);
    setSettings(s);
    setKb(k);
  }, [projectId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleClearKB = async () => {
    setClearing(true);
    await clearProjectKB(projectId);
    await load();
    onKBChange?.();
    setClearing(false);
  };

  const handleResetUsage = async () => {
    await resetUsage();
    const s = await getSettings();
    setSettings(s);
  };

  const shortModel = settings?.model.split("/").pop() ?? "—";
  const hasUsage = settings && (settings.usage.input_tokens > 0 || settings.usage.output_tokens > 0);

  return (
    <aside style={{
      width: 264,
      minHeight: "100vh",
      background: "white",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      borderRight: "1px solid #e2e8f0",
      overflowY: "auto",
      overflowX: "hidden",
    }}>

      {/* ── Brand ── */}
      <Box sx={{ px: 3, pt: 3.5, pb: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: "11px", flexShrink: 0,
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(79,70,229,0.3)",
          }}>
            <BoltIcon sx={{ fontSize: 19, color: "white" }} />
          </Box>
          <Box>
            <Typography sx={{ color: "#1e293b", fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>
              QA Intelligence
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: "4px", mt: 0.3 }}>
              <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#f59e0b" }} />
              <Typography sx={{ color: "#94a3b8", fontSize: 10, fontWeight: 500 }}>
                Three-Brain Architecture
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ mx: 3, borderBottom: "1px solid #f1f5f9" }} />

      {/* ── LLM Model ── */}
      <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: 1.5 }}>
          <TuneIcon sx={{ fontSize: 12, color: "#94a3b8" }} />
          <Typography sx={{ color: "#94a3b8", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            LLM Model
          </Typography>
        </Box>
        <Tooltip title={settings?.model ?? ""} placement="right">
          <Box sx={{
            background: "#eef2ff",
            border: "1px solid #c7d2fe",
            borderRadius: "11px",
            px: 2, py: 1.5,
            display: "flex", alignItems: "center", gap: "10px",
          }}>
            <Box sx={{
              width: 7, height: 7, borderRadius: "50%", bgcolor: "#4ade80", flexShrink: 0,
              boxShadow: "0 0 5px #4ade80",
            }} />
            <Typography sx={{
              color: "#4338ca", fontWeight: 700, fontSize: 12,
              fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {shortModel}
            </Typography>
          </Box>
        </Tooltip>
      </Box>

      <Box sx={{ mx: 3, borderBottom: "1px solid #f1f5f9" }} />

      {/* ── Session Usage ── */}
      <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Typography sx={{ color: "#94a3b8", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Session Usage
          </Typography>
          {hasUsage && (
            <Tooltip title="Reset usage counters">
              <IconButton size="small" onClick={handleResetUsage} sx={{ color: "#cbd5e1", "&:hover": { color: "#64748b" }, p: 0.5 }}>
                <RefreshIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {settings ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {/* Input tokens */}
            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.6 }}>
                <Typography sx={{ color: "#64748b", fontSize: 11 }}>Input</Typography>
                <Typography sx={{ color: "#1e293b", fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>
                  {settings.usage.input_tokens.toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ height: 4, borderRadius: 2, bgcolor: "#f1f5f9", overflow: "hidden" }}>
                <Box sx={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#6366f1,#818cf8)", width: `${Math.min(100, (settings.usage.input_tokens / 10000) * 100)}%`, minWidth: settings.usage.input_tokens > 0 ? "6px" : 0, transition: "width 0.4s" }} />
              </Box>
            </Box>

            {/* Output tokens */}
            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.6 }}>
                <Typography sx={{ color: "#64748b", fontSize: 11 }}>Output</Typography>
                <Typography sx={{ color: "#1e293b", fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>
                  {settings.usage.output_tokens.toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ height: 4, borderRadius: 2, bgcolor: "#f1f5f9", overflow: "hidden" }}>
                <Box sx={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#0ea5e9,#38bdf8)", width: `${Math.min(100, (settings.usage.output_tokens / 5000) * 100)}%`, minWidth: settings.usage.output_tokens > 0 ? "6px" : 0, transition: "width 0.4s" }} />
              </Box>
            </Box>

            {/* Cost breakdown */}
            {settings.cost ? (
              <Box sx={{
                mt: 0.5, p: 1.5, borderRadius: "10px",
                background: "#f8fafc", border: "1px solid #e2e8f0",
              }}>
                {[
                  { label: "Input cost",  value: `$${settings.cost.input_cost.toFixed(4)}`,  color: "#6366f1" },
                  { label: "Output cost", value: `$${settings.cost.output_cost.toFixed(4)}`, color: "#0ea5e9" },
                ].map((row) => (
                  <Box key={row.label} sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography sx={{ color: "#94a3b8", fontSize: 10.5 }}>{row.label}</Typography>
                    <Typography sx={{ color: row.color, fontSize: 10.5, fontWeight: 700, fontFamily: "monospace" }}>{row.value}</Typography>
                  </Box>
                ))}
                <Box sx={{ borderTop: "1px solid #e2e8f0", pt: 0.8, mt: 0.5, display: "flex", justifyContent: "space-between" }}>
                  <Typography sx={{ color: "#475569", fontSize: 11, fontWeight: 600 }}>Total</Typography>
                  <Typography sx={{ color: "#4f46e5", fontSize: 11, fontWeight: 800, fontFamily: "monospace" }}>
                    ${settings.cost.total_cost.toFixed(4)}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Typography sx={{ color: "#cbd5e1", fontSize: 10.5, mt: 0.5 }}>No API calls yet</Typography>
            )}
          </Box>
        ) : (
          <CircularProgress size={14} sx={{ color: "#cbd5e1" }} />
        )}
      </Box>

      <Box sx={{ mx: 3, borderBottom: "1px solid #f1f5f9" }} />

      {/* ── Knowledge Base ── */}
      <Box sx={{ px: 3, pt: 2.5, pb: 3, flex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: 2 }}>
          <StorageIcon sx={{ fontSize: 12, color: "#94a3b8" }} />
          <Typography sx={{ color: "#94a3b8", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Knowledge Base
          </Typography>
        </Box>

        {kb ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
              {[
                { label: "Chunks", value: kb.chunks,               icon: StorageIcon, color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
                { label: "Nodes",  value: kb.graph?.total_nodes ?? 0, icon: HubIcon,     color: "#0ea5e9", bg: "#e0f2fe", border: "#bae6fd" },
              ].map(({ label, value, icon: Icon, color, bg, border }) => (
                <Box key={label} sx={{ bgcolor: bg, border: `1px solid ${border}`, borderRadius: "12px", p: 1.5, textAlign: "center" }}>
                  <Icon sx={{ fontSize: 15, color, mb: 0.5 }} />
                  <Typography sx={{ color: "#1e293b", fontWeight: 800, fontSize: 18, lineHeight: 1 }}>{value}</Typography>
                  <Typography sx={{ color: "#94a3b8", fontSize: 10, mt: 0.3 }}>{label}</Typography>
                </Box>
              ))}
            </Box>

            {kb.sources.length > 0 && (
              <Box sx={{ bgcolor: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: "10px", p: 1.5 }}>
                <Typography sx={{ color: "#94a3b8", fontSize: 10, lineHeight: 1.6 }}>
                  {kb.sources.slice(0, 3).join(", ")}
                  {kb.sources.length > 3 && (
                    <span style={{ color: "#6366f1" }}> +{kb.sources.length - 3} more</span>
                  )}
                </Typography>
              </Box>
            )}

            <button
              onClick={handleClearKB}
              disabled={clearing}
              style={{
                marginTop: 4,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                width: "100%", padding: "8px 0", borderRadius: 10,
                border: "1px solid #fecaca", background: "#fef2f2",
                color: "#ef4444", fontSize: 12, fontWeight: 600,
                cursor: clearing ? "not-allowed" : "pointer",
                opacity: clearing ? 0.5 : 1, transition: "all 0.15s",
              }}
              onMouseOver={e => { if (!clearing) { (e.currentTarget as HTMLButtonElement).style.background = "#fee2e2"; } }}
              onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fef2f2"; }}
            >
              <DeleteIcon style={{ fontSize: 14 }} />
              {clearing ? "Clearing…" : "Clear Knowledge Base"}
            </button>
          </Box>
        ) : (
          <CircularProgress size={14} sx={{ color: "#cbd5e1" }} />
        )}
      </Box>

      {/* ── Footer ── */}
      <Box sx={{ px: 3, pb: 3 }}>
        <Box sx={{ borderBottom: "1px solid #f1f5f9", mb: 2 }} />
        <Typography sx={{ color: "#cbd5e1", fontSize: 10.5 }}>QA Intelligence v1.0</Typography>
      </Box>
    </aside>
  );
}
