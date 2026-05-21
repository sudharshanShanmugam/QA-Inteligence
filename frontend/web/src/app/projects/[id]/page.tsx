"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Box, Typography, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import StorageIcon from "@mui/icons-material/Storage";
import Sidebar from "@/components/Sidebar";
import IngestTab from "@/components/IngestTab";
import AnalyzeTab from "@/components/AnalyzeTab";
import { getProjectKBStatus } from "@/lib/api";

const TABS = [
  { label: "Ingest",            icon: UploadFileIcon,  desc: "Build knowledge base" },
  { label: "Analyze & Generate", icon: AutoAwesomeIcon, desc: "Generate test plans"   },
];

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [tab, setTab] = useState(0);
  const [kbChunks, setKbChunks] = useState(0);
  const [projectName, setProjectName] = useState("");
  const [loadingName, setLoadingName] = useState(true);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

  const loadKB = useCallback(async () => {
    try {
      const s = await getProjectKBStatus(projectId);
      setKbChunks(s.chunks);
    } catch {}
    setSidebarRefreshKey((k) => k + 1);
  }, [projectId]);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/projects/${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setProjectName(data.name ?? "");
          setKbChunks(data.chunks ?? 0);
        }
      } catch {}
      setLoadingName(false);
    };
    init();
  }, [projectId]);

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden", bgcolor: "#f1f5f9" }}>
      <Sidebar projectId={projectId} onKBChange={loadKB} refreshKey={sidebarRefreshKey} />

      {/* ── Main area ── */}
      <Box sx={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

        {/* ── Top bar ── */}
        <Box sx={{
          position: "sticky", top: 0, zIndex: 10,
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #e2e8f0",
          px: 4, py: 0,
        }}>
          {/* Breadcrumb row */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, pt: 2, pb: 1.5 }}>
            <button
              onClick={() => router.push("/")}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                color: "#94a3b8", fontSize: 13, fontWeight: 600,
                background: "none", border: "none", cursor: "pointer",
                padding: "4px 8px", borderRadius: 8,
                transition: "all 0.15s",
              }}
              onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = "#4f46e5"; (e.currentTarget as HTMLButtonElement).style.background = "#eef2ff"; }}
              onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            >
              <ArrowBackIcon sx={{ fontSize: 14 }} />
              Projects
            </button>
            <Box sx={{ color: "#e2e8f0", fontSize: 16, fontWeight: 300 }}>/</Box>
            {loadingName ? (
              <CircularProgress size={12} sx={{ color: "#94a3b8" }} />
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography sx={{ color: "#1e293b", fontWeight: 700, fontSize: 14 }}>
                  {projectName}
                </Typography>
                {kbChunks > 0 && (
                  <Box sx={{
                    display: "flex", alignItems: "center", gap: "4px",
                    px: "8px", py: "3px", borderRadius: "999px",
                    bgcolor: "#ecfdf5", border: "1px solid #a7f3d0",
                  }}>
                    <StorageIcon sx={{ fontSize: 10, color: "#10b981" }} />
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#065f46" }}>
                      {kbChunks} chunks
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>

          {/* Tab switcher */}
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {TABS.map(({ label, icon: Icon }, i) => (
              <Box
                key={label}
                component="button"
                onClick={() => setTab(i)}
                sx={{
                  display: "flex", alignItems: "center", gap: "7px",
                  px: "16px", py: "9px",
                  borderTop: "none", borderLeft: "none", borderRight: "none",
                  borderBottom: `2.5px solid ${tab === i ? "#4f46e5" : "transparent"}`,
                  borderRadius: 0,
                  background: "none",
                  color: tab === i ? "#4f46e5" : "#94a3b8",
                  fontWeight: tab === i ? 700 : 500,
                  fontSize: 13.5,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "color 0.15s, border-bottom-color 0.15s",
                  "&:hover": { color: tab === i ? "#4f46e5" : "#64748b" },
                }}
              >
                <Icon sx={{ fontSize: 15 }} />
                {label}
              </Box>
            ))}
          </Box>
        </Box>

        {/* ── Content ── */}
        <Box sx={{ flex: 1, p: 4, width: "100%" }}>
          {tab === 0 && <IngestTab projectId={projectId} onIngestComplete={loadKB} />}
          {tab === 1 && <AnalyzeTab kbChunks={kbChunks} projectId={projectId} />}
        </Box>
      </Box>
    </Box>
  );
}
