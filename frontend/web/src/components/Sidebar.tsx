"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Divider, Chip, CircularProgress,
  Tooltip, IconButton,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { getSettings, getKBStatus, clearKB, resetUsage, AppSettings, KBStatus } from "@/lib/api";

export default function Sidebar() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [kb, setKb] = useState<KBStatus | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    const [s, k] = await Promise.all([getSettings(), getKBStatus()]);
    setSettings(s);
    setKb(k);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleClearKB = async () => {
    setClearing(true);
    await clearKB();
    await load();
    setClearing(false);
  };

  const handleResetUsage = async () => {
    await resetUsage();
    const s = await getSettings();
    setSettings(s);
  };

  const shortModel = settings?.model.split("/").pop() ?? "—";

  return (
    <aside className="w-[280px] min-h-screen bg-slate-800 border-r border-slate-700 flex flex-col p-4 gap-4 shrink-0">
      {/* Brand */}
      <Box>
        <Typography variant="h6" className="font-bold text-white">
          QA Intelligence
        </Typography>
        <Typography variant="caption" className="text-slate-400">
          Three-Brain QA Architecture
        </Typography>
      </Box>

      <Divider className="border-slate-700" />

      {/* Model */}
      <Box>
        <Typography variant="caption" className="text-slate-400 uppercase tracking-widest text-[10px]">
          LLM Model
        </Typography>
        <Tooltip title={settings?.model ?? ""} placement="right">
          <Chip
            label={shortModel}
            size="small"
            className="mt-1 bg-emerald-900 text-emerald-300 font-mono text-xs w-full justify-start"
          />
        </Tooltip>
      </Box>

      {/* Token usage */}
      {settings && (
        <Box className="bg-slate-900 rounded-lg p-3 text-xs">
          <Box className="flex justify-between items-center mb-2">
            <Typography variant="caption" className="text-slate-400 uppercase tracking-widest text-[10px]">
              Session Usage
            </Typography>
            {(settings.usage.input_tokens > 0 || settings.usage.output_tokens > 0) && (
              <Tooltip title="Reset usage counters">
                <IconButton size="small" onClick={handleResetUsage} className="text-slate-500 hover:text-slate-300">
                  <RefreshIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          <Box className="flex justify-between text-slate-400 mb-1">
            <span>Input</span>
            <span className="text-slate-200">{settings.usage.input_tokens.toLocaleString()} tok</span>
          </Box>
          <Box className="flex justify-between text-slate-400 mb-1">
            <span>Output</span>
            <span className="text-slate-200">{settings.usage.output_tokens.toLocaleString()} tok</span>
          </Box>

          {settings.cost ? (
            <>
              <Divider className="border-slate-700 my-2" />
              <Box className="flex justify-between text-slate-400 mb-1">
                <span>Input cost</span>
                <span className="text-sky-400">${settings.cost.input_cost.toFixed(4)}</span>
              </Box>
              <Box className="flex justify-between text-slate-400 mb-1">
                <span>Output cost</span>
                <span className="text-sky-400">${settings.cost.output_cost.toFixed(4)}</span>
              </Box>
              <Box className="flex justify-between font-semibold mt-1">
                <span className="text-white">Total</span>
                <span className="text-emerald-400">${settings.cost.total_cost.toFixed(4)}</span>
              </Box>
              <Typography variant="caption" className="text-slate-600 block mt-2">
                ${settings.cost.input_rate} / ${settings.cost.output_rate} per 1M in/out
              </Typography>
            </>
          ) : (
            <Typography variant="caption" className="text-slate-600 block mt-1">
              {settings.cost === null
                ? `$${(settings as any).input_rate ?? "—"} / — per 1M — no calls yet`
                : "Pricing unavailable"}
            </Typography>
          )}
        </Box>
      )}

      <Divider className="border-slate-700" />

      {/* KB status */}
      <Box>
        <Typography variant="caption" className="text-slate-400 uppercase tracking-widest text-[10px]">
          Knowledge Base
        </Typography>
        {kb ? (
          <Box className="mt-2 grid grid-cols-2 gap-2">
            <Box className="bg-slate-900 rounded p-2 text-center">
              <Typography variant="h6" className="text-white font-bold leading-none">{kb.chunks}</Typography>
              <Typography variant="caption" className="text-slate-400">Chunks</Typography>
            </Box>
            <Box className="bg-slate-900 rounded p-2 text-center">
              <Typography variant="h6" className="text-white font-bold leading-none">
                {kb.graph?.total_nodes ?? 0}
              </Typography>
              <Typography variant="caption" className="text-slate-400">Nodes</Typography>
            </Box>
            {kb.sources.length > 0 && (
              <Box className="col-span-2">
                <Typography variant="caption" className="text-slate-500 text-[10px]">
                  {kb.sources.slice(0, 3).join(", ")}
                  {kb.sources.length > 3 && ` +${kb.sources.length - 3} more`}
                </Typography>
              </Box>
            )}
          </Box>
        ) : (
          <CircularProgress size={16} className="mt-2 text-slate-500" />
        )}

        <button
          onClick={handleClearKB}
          disabled={clearing}
          className="mt-3 w-full text-xs py-1.5 rounded border border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          {clearing ? "Clearing…" : "Clear Knowledge Base"}
        </button>
      </Box>

      <div className="mt-auto">
        <Divider className="border-slate-700 mb-3" />
        <Typography variant="caption" className="text-slate-600">
          QA Intelligence v1.0
        </Typography>
      </div>
    </aside>
  );
}
