"use client";

import { useState, useEffect } from "react";
import { Box, Tab, Tabs } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import Sidebar from "@/components/Sidebar";
import IngestTab from "@/components/IngestTab";
import AnalyzeTab from "@/components/AnalyzeTab";
import { getKBStatus } from "@/lib/api";

export default function Home() {
  const [tab, setTab] = useState(0);
  const [kbChunks, setKbChunks] = useState(0);

  useEffect(() => {
    getKBStatus().then((s) => setKbChunks(s.chunks)).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        {/* Top tab bar */}
        <Box className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 px-6">
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            textColor="inherit"
            sx={{ "& .MuiTabs-indicator": { backgroundColor: "#38bdf8" } }}
          >
            <Tab
              icon={<UploadFileIcon fontSize="small" />}
              iconPosition="start"
              label="Ingest"
              className={`text-sm font-medium min-h-[48px] ${tab === 0 ? "text-sky-400" : "text-slate-400"}`}
            />
            <Tab
              icon={<AutoAwesomeIcon fontSize="small" />}
              iconPosition="start"
              label="Analyze & Generate"
              className={`text-sm font-medium min-h-[48px] ${tab === 1 ? "text-sky-400" : "text-slate-400"}`}
            />
          </Tabs>
        </Box>

        {/* Tab content */}
        <Box className="p-6 max-w-5xl">
          {tab === 0 && <IngestTab />}
          {tab === 1 && <AnalyzeTab kbChunks={kbChunks} />}
        </Box>
      </main>
    </div>
  );
}
