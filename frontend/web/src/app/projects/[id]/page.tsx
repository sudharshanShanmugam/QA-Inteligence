"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Box, Typography, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MenuIcon from "@mui/icons-material/Menu";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import HistoryIcon from "@mui/icons-material/History";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CloseIcon from "@mui/icons-material/Close";
import Sidebar from "@/components/Sidebar";
import IngestTab from "@/components/IngestTab";
import AnalyzeTab from "@/components/AnalyzeTab";
import ChatTab from "@/components/ChatTab";
import { getProjectKBStatus } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

const TABS = [
  { label: "Ingest",             icon: UploadFileIcon,  desc: "Build knowledge base" },
  { label: "Analyze & Generate", icon: AutoAwesomeIcon, desc: "Generate test plans"  },
  { label: "Analysis History",   icon: HistoryIcon,     desc: "Past analyses"        },
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
  const [llmSettingsVersion, setLlmSettingsVersion] = useState(0);
  const [analysisContext, setAnalysisContext] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [fabPos, setFabPos] = useState({ x: 0, y: 0 });
  const [fabSnapping, setFabSnapping] = useState(false);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startFabX: 0, startFabY: 0, moved: false });
  const popupRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  const loadKB = useCallback(async () => {
    try {
      const s = await getProjectKBStatus(projectId);
      setKbChunks(s.chunks);
    } catch {}
    setSidebarRefreshKey((k) => k + 1);
  }, [projectId]);

  useEffect(() => {
    setFabPos({ x: window.innerWidth - 56 - 20, y: window.innerHeight - 56 - 32 });
  }, []);

  useEffect(() => {
    if (!chatOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        fabRef.current && !fabRef.current.contains(e.target as Node)
      ) {
        setChatOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [chatOpen]);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:2222"}/api/projects/${projectId}`);
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
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden", bgcolor: "background.default" }}>
      <Box sx={{
        width: sidebarOpen ? 264 : 0,
        flexShrink: 0,
        overflow: "hidden",
        transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
      }}>
        <Sidebar projectId={projectId} onKBChange={loadKB} onSettingsChange={() => setLlmSettingsVersion(v => v + 1)} refreshKey={sidebarRefreshKey} />
      </Box>

      {/* ── Main area ── */}
      <Box sx={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

        {/* ── Top bar ── */}
        <Box sx={{
          position: "sticky", top: 0, zIndex: 10,
          bgcolor: "background.paper",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid", borderBottomColor: "divider",
          px: 4, py: 0,
        }}>
          {/* Breadcrumb row */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, pt: 2, pb: 1.5 }}>
            {/* Sidebar toggle */}
            <Box
              component="button"
              onClick={() => setSidebarOpen((o) => !o)}
              sx={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, borderRadius: "8px", border: "none",
                bgcolor: "transparent", color: "text.disabled", cursor: "pointer",
                flexShrink: 0, transition: "all 0.15s",
                "&:hover": { bgcolor: "action.hover", color: "primary.main" },
              }}
            >
              {sidebarOpen ? <MenuOpenIcon sx={{ fontSize: 18 }} /> : <MenuIcon sx={{ fontSize: 18 }} />}
            </Box>
            <Box
              component="button"
              onClick={() => router.push("/")}
              sx={{
                display: "flex", alignItems: "center", gap: "5px",
                color: "text.secondary", fontSize: 13, fontWeight: 600,
                background: "none", border: "none", cursor: "pointer",
                padding: "4px 8px", borderRadius: "8px",
                transition: "all 0.15s",
                "&:hover": { color: "primary.main", bgcolor: "primary.main" + "12" },
              }}
            >
              <ArrowBackIcon sx={{ fontSize: 14 }} />
              Projects
            </Box>
            <Box sx={{ color: "divider", fontSize: 16, fontWeight: 300 }}>/</Box>
            {loadingName ? (
              <CircularProgress size={12} sx={{ color: "text.disabled" }} />
            ) : (
              <Typography sx={{ color: "text.primary", fontWeight: 700, fontSize: 14 }}>
                {projectName}
              </Typography>
            )}
            {/* Dark mode toggle — right-aligned */}
            <Box sx={{ ml: "auto" }}>
              <ThemeToggle />
            </Box>
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
                  borderBottom: "2.5px solid",
                  borderBottomColor: tab === i ? "primary.main" : "transparent",
                  borderRadius: 0,
                  background: "none",
                  color: tab === i ? "primary.main" : "text.disabled",
                  fontWeight: tab === i ? 700 : 500,
                  fontSize: 13.5,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "color 0.15s, border-bottom-color 0.15s",
                  "&:hover": { color: tab === i ? "primary.main" : "text.secondary" },
                }}
              >
                <Icon sx={{ fontSize: 15 }} />
                {label}
              </Box>
            ))}
          </Box>
        </Box>

        {/* ── Content ── */}
        <Box sx={{ flex: 1, p: 4, width: "100%", bgcolor: "background.default" }}>
          {tab === 0 && <IngestTab projectId={projectId} onIngestComplete={loadKB} />}
          {/* Keep AnalyzeTab always mounted so history state survives tab switches */}
          <Box sx={{ display: tab === 0 ? "none" : "block" }}>
            <AnalyzeTab
              kbChunks={kbChunks}
              projectId={projectId}
              onAnalyzeComplete={loadKB}
              onAnalysisDone={(ctx) => setAnalysisContext(ctx)}
              historyOnly={tab === 2}
              llmSettingsVersion={llmSettingsVersion}
            />
          </Box>
        </Box>
      </Box>

      {/* ── Chat popup — always mounted to preserve session history ── */}
      {(() => {
        const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
        const popupW = 380, popupH = 540, fabSize = 56, gap = 12;
        const popupLeft = Math.max(8, Math.min(fabPos.x + fabSize - popupW, vw - popupW - 8));
        const spaceAbove = fabPos.y - popupH - gap;
        const popupTop = spaceAbove >= 8 ? spaceAbove : fabPos.y + fabSize + gap;
        return (
        <Box ref={popupRef} sx={{
          position: "fixed", top: popupTop, left: popupLeft,
          width: 380, height: 540,
          bgcolor: "background.paper", borderRadius: "20px",
          border: "1px solid", borderColor: "divider",
          boxShadow: "0 16px 48px rgba(0,0,0,0.18)",
          display: chatOpen ? "flex" : "none",
          flexDirection: "column",
          overflow: "hidden", zIndex: 1300,
          animation: chatOpen ? "popUp 0.22s cubic-bezier(0.34,1.56,0.64,1) both" : "none",
          "@keyframes popUp": {
            from: { opacity: 0, transform: "scale(0.85) translateY(16px)" },
            to:   { opacity: 1, transform: "scale(1) translateY(0)" },
          },
        }}>
          {/* Popup header */}
          <Box sx={{
            px: 2.5, py: 1.5,
            display: "flex", alignItems: "center", gap: 1.5,
            borderBottom: "1px solid", borderBottomColor: "divider", flexShrink: 0,
          }}>
            <Box sx={{
              width: 28, height: 28, borderRadius: "8px",
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <SmartToyIcon sx={{ fontSize: 15, color: "white" }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: "text.primary", lineHeight: 1.2 }}>QA Assistant</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: "4px", mt: 0.2 }}>
                <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#10b981", boxShadow: "0 0 4px #10b981" }} />
                <Typography sx={{ fontSize: 10.5, color: "#10b981", fontWeight: 600 }}>Online</Typography>
              </Box>
            </Box>
            <Box
              component="button"
              onClick={() => setChatOpen(false)}
              sx={{
                width: 28, height: 28, borderRadius: "8px", border: "none",
                bgcolor: "action.hover", color: "text.secondary", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                "&:hover": { bgcolor: "action.selected", color: "text.primary" },
              }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </Box>
          </Box>
          <ChatTab projectId={projectId} context={analysisContext} onMessageComplete={() => setSidebarRefreshKey((k) => k + 1)} />
        </Box>
        );
      })()}

      {/* ── FAB (draggable) ── */}
      <Box
        component="button"
        ref={fabRef}
        onPointerDown={(e: React.PointerEvent<HTMLElement>) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setFabSnapping(false);
          dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, startFabX: fabPos.x, startFabY: fabPos.y, moved: false };
        }}
        onPointerMove={(e: React.PointerEvent<HTMLElement>) => {
          if (!dragRef.current.dragging) return;
          const dx = e.clientX - dragRef.current.startX;
          const dy = e.clientY - dragRef.current.startY;
          if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragRef.current.moved = true;
          if (dragRef.current.moved) {
            setFabPos({
              x: Math.max(20, Math.min(window.innerWidth - 56 - 20, dragRef.current.startFabX + dx)),
              y: Math.max(20, Math.min(window.innerHeight - 56 - 20, dragRef.current.startFabY + dy)),
            });
          }
        }}
        onPointerUp={(e: React.PointerEvent<HTMLElement>) => {
          if (!dragRef.current.dragging) return;
          dragRef.current.dragging = false;
          if (!dragRef.current.moved) {
            setChatOpen((o) => !o);
          } else {
            // Snap to nearest horizontal edge
            const snapX = (fabPos.x + 28) < window.innerWidth / 2 ? 20 : window.innerWidth - 56 - 20;
            const clampedY = Math.max(20, Math.min(window.innerHeight - 56 - 20, fabPos.y));
            setFabSnapping(true);
            setFabPos({ x: snapX, y: clampedY });
          }
        }}
        sx={{
          position: "fixed", top: fabPos.y, left: fabPos.x,
          width: 56, height: 56, borderRadius: "50%",
          border: "none",
          cursor: "grab",
          touchAction: "none",
          userSelect: "none",
          background: chatOpen
            ? "#475569"
            : "linear-gradient(135deg, #4f46e5, #7c3aed)",
          boxShadow: chatOpen
            ? "0 4px 16px rgba(0,0,0,0.2)"
            : "0 8px 24px rgba(79,70,229,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1400,
          transition: fabSnapping
            ? "top 0.25s cubic-bezier(0.34,1.56,0.64,1), left 0.25s cubic-bezier(0.34,1.56,0.64,1), background 0.2s, box-shadow 0.2s"
            : "background 0.2s, box-shadow 0.2s",
          "&:hover": {
            boxShadow: chatOpen
              ? "0 6px 20px rgba(0,0,0,0.25)"
              : "0 12px 28px rgba(79,70,229,0.5)",
          },
        }}
      >
        {chatOpen
          ? <CloseIcon sx={{ fontSize: 22, color: "white" }} />
          : <SmartToyIcon sx={{ fontSize: 24, color: "white" }} />
        }
      </Box>
    </Box>
  );
}
