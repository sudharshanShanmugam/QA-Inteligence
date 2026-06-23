"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Typography, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Button, CircularProgress, Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BoltIcon from "@mui/icons-material/Bolt";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import StorageIcon from "@mui/icons-material/Storage";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SearchIcon from "@mui/icons-material/Search";
import SortIcon from "@mui/icons-material/Sort";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DataObjectIcon from "@mui/icons-material/DataObject";
import { listProjects, createProject, deleteProject, Project } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

// ── Helpers ──────────────────────────────────────────────────────────────────

const ACCENT_COLORS = [
  "#4f46e5", "#0ea5e9", "#10b981", "#8b5cf6",
  "#f59e0b", "#ec4899", "#06b6d4", "#ef4444",
];

function getAccent(index: number) { return ACCENT_COLORS[index % ACCENT_COLORS.length]; }

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── KPI Strip ─────────────────────────────────────────────────────────────────

function KpiStrip({ projects }: { projects: Project[] }) {
  const totalChunks = projects.reduce((s, p) => s + (p.chunks ?? 0), 0);
  const totalFiles  = projects.reduce((s, p) => s + (p.file_count ?? 0), 0);
  const readyCount  = projects.filter((p) => (p.chunks ?? 0) > 0).length;

  const kpis = [
    { icon: FolderOpenIcon,  label: "Projects",    value: projects.length,              color: "#4f46e5" },
    { icon: StorageIcon,     label: "KB Chunks",   value: totalChunks.toLocaleString(), color: "#0ea5e9" },
    { icon: InsertDriveFileIcon, label: "Files",   value: totalFiles,                   color: "#10b981" },
    { icon: CheckCircleIcon, label: "KB Ready",    value: readyCount,                   color: "#8b5cf6" },
  ];

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2, mb: 4 }}>
      {kpis.map(({ icon: Icon, label, value, color }) => (
        <Box key={label} sx={{
          bgcolor: "background.paper",
          border: "1px solid", borderColor: "divider",
          borderRadius: "12px", px: 3, py: 2.5,
          display: "flex", alignItems: "center", gap: 2,
          transition: "box-shadow 0.15s",
          "&:hover": { boxShadow: "0 4px 16px rgba(0,0,0,0.06)" },
        }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: color + "12", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon sx={{ fontSize: 20, color }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 24, fontWeight: 800, color: "text.primary", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
              {value}
            </Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary", fontWeight: 500, mt: 0.25 }}>
              {label}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// ── Project Card ──────────────────────────────────────────────────────────────

function ProjectCard({ project, index, onOpen, onDelete }: {
  project: Project; index: number; onOpen: () => void; onDelete: () => void;
}) {
  const accent = getAccent(index);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hasKB = (project.chunks ?? 0) > 0;

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: "1px solid", borderColor: "divider",
        borderRadius: "16px", overflow: "hidden",
        transition: "all 0.18s",
        cursor: "pointer",
        position: "relative",
        "&:hover": {
          borderColor: accent + "60",
          boxShadow: `0 4px 20px ${accent}14`,
          transform: "translateY(-1px)",
        },
        "&:hover .card-actions": { opacity: 1 },
      }}
      onClick={onOpen}
    >
      {/* Color accent bar */}
      <Box sx={{ height: 3, bgcolor: accent }} />

      <Box sx={{ p: 2.5 }}>
        {/* Header row */}
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
            {/* Folder icon */}
            <Box sx={{ width: 36, height: 36, borderRadius: "10px", bgcolor: accent + "12", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FolderOpenIcon sx={{ fontSize: 18, color: accent }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: "text.primary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                {project.name}
              </Typography>
              {project.description ? (
                <Typography sx={{ fontSize: 11.5, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                  {project.description}
                </Typography>
              ) : (
                <Typography sx={{ fontSize: 11.5, color: "text.disabled" }}>No description</Typography>
              )}
            </Box>
          </Box>

          {/* Action buttons – visible on hover */}
          <Box
            className="card-actions"
            sx={{ display: "flex", gap: 0.75, opacity: 0, transition: "opacity 0.15s", flexShrink: 0, ml: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Tooltip title="Open project">
              <Box component="button" onClick={onOpen} sx={{
                width: 28, height: 28, borderRadius: "8px", border: "1px solid", borderColor: "divider",
                bgcolor: "background.default", color: "text.secondary", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                "&:hover": { bgcolor: accent + "12", color: accent, borderColor: accent + "40" },
                transition: "all 0.12s",
              }}>
                <ArrowForwardIcon sx={{ fontSize: 14 }} />
              </Box>
            </Tooltip>
            <Tooltip title="Delete project">
              <Box component="button" onClick={() => setConfirmDelete(true)} sx={{
                width: 28, height: 28, borderRadius: "8px", border: "1px solid", borderColor: "divider",
                bgcolor: "background.default", color: "text.secondary", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                "&:hover": { bgcolor: "#fef2f2", color: "#ef4444", borderColor: "#fecaca" },
                transition: "all 0.12s",
              }}>
                <DeleteOutlineIcon sx={{ fontSize: 14 }} />
              </Box>
            </Tooltip>
          </Box>
        </Box>

        {/* Stats row */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          {/* KB status chip */}
          <Box sx={{
            display: "flex", alignItems: "center", gap: "5px",
            px: "8px", py: "3px", borderRadius: "6px",
            bgcolor: hasKB ? "#ecfdf5" : "background.default",
            border: "1px solid", borderColor: hasKB ? "#a7f3d0" : "divider",
          }}>
            <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: hasKB ? "#10b981" : "text.disabled" }} />
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: hasKB ? "#065f46" : "text.disabled" }}>
              {hasKB ? `${project.chunks} chunks` : "Empty KB"}
            </Typography>
          </Box>

          {(project.file_count ?? 0) > 0 && (
            <Box sx={{
              display: "flex", alignItems: "center", gap: "5px",
              px: "8px", py: "3px", borderRadius: "6px",
              bgcolor: "background.default",
              border: "1px solid", borderColor: "divider",
            }}>
              <InsertDriveFileIcon sx={{ fontSize: 11, color: "text.disabled" }} />
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: "text.secondary" }}>
                {project.file_count} {project.file_count === 1 ? "file" : "files"}
              </Typography>
            </Box>
          )}

          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: "4px" }}>
            <CalendarTodayIcon sx={{ fontSize: 10, color: "text.disabled" }} />
            <Typography sx={{ fontSize: 11, color: "text.disabled" }}>
              {formatDate(project.created_at)}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Delete confirm overlay */}
      {confirmDelete && (
        <Box
          sx={{
            position: "absolute", inset: 0, bgcolor: "background.paper",
            borderRadius: "16px", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 2, p: 3,
            zIndex: 2,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Typography sx={{ fontWeight: 700, fontSize: 13, color: "text.primary", textAlign: "center" }}>
            Delete "{project.name}"?
          </Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary", textAlign: "center", lineHeight: 1.5 }}>
            This will remove the project and all its data permanently.
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button size="small" variant="outlined" onClick={() => setConfirmDelete(false)}
              sx={{ borderRadius: "8px", textTransform: "none", fontSize: 12 }}>
              Cancel
            </Button>
            <Button size="small" variant="contained" color="error" onClick={onDelete}
              sx={{ borderRadius: "8px", textTransform: "none", fontSize: 12 }}>
              Delete
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ── New Project Dialog ─────────────────────────────────────────────────────────

function NewProjectDialog({ open, onClose, onCreate }: {
  open: boolean; onClose: () => void; onCreate: (name: string, desc: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name.trim(), desc.trim());
    setSaving(false);
    setName(""); setDesc("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      slotProps={{ paper: { sx: { borderRadius: "16px", bgcolor: "background.paper" } } }}>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: "10px", bgcolor: "primary.main", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AddIcon sx={{ fontSize: 18, color: "white" }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: "text.primary" }}>New Project</Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Create a QA workspace</Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: "16px !important" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", mb: 0.75 }}>
              Project Name <span style={{ color: "#ef4444" }}>*</span>
            </Typography>
            <TextField fullWidth size="small" value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Payment Service QA"
              autoFocus
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", mb: 0.75 }}>
              Description <span style={{ fontSize: 11, fontWeight: 400, color: "text.disabled" }}>(optional)</span>
            </Typography>
            <TextField fullWidth size="small" multiline rows={2} value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What will this project cover?"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: "text.secondary", borderRadius: "8px", textTransform: "none" }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleCreate}
          disabled={!name.trim() || saving}
          startIcon={saving ? <CircularProgress size={13} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: 14 }} />}
          sx={{
            bgcolor: "primary.main", "&:hover": { bgcolor: "primary.dark" },
            borderRadius: "8px", textTransform: "none", fontWeight: 600, px: 2.5,
            boxShadow: "0 4px 12px rgba(79,70,229,0.25)",
          }}
        >
          {saving ? "Creating…" : "Create Project"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Box sx={{
      border: "2px dashed", borderColor: "divider",
      borderRadius: "16px", py: 8, px: 4,
      textAlign: "center", bgcolor: "background.paper",
    }}>
      <Box sx={{
        width: 56, height: 56, borderRadius: "16px",
        bgcolor: "primary.main" + "12",
        display: "flex", alignItems: "center", justifyContent: "center",
        mx: "auto", mb: 2,
      }}>
        <FolderOpenIcon sx={{ fontSize: 28, color: "primary.main" }} />
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: 16, color: "text.primary", mb: 1 }}>
        No projects yet
      </Typography>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 3, maxWidth: 360, mx: "auto", lineHeight: 1.6 }}>
        Create a project to start uploading documents and generating AI-powered QA test plans.
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1, mb: 3 }}>
        {["Upload BRD / SRS", "Run AI analysis", "Export test plans"].map((step, i) => (
          <Box key={step} sx={{
            display: "flex", alignItems: "center", gap: 1,
            px: "12px", py: "6px", borderRadius: "999px",
            bgcolor: ["primary.main", "secondary.main", "success.main"][i] + "10",
            border: "1px solid",
            borderColor: ["primary.main", "secondary.main", "success.main"][i] + "30",
          }}>
            <Box sx={{ width: 16, height: 16, borderRadius: "50%", bgcolor: ["primary.main", "secondary.main", "success.main"][i], display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography sx={{ fontSize: 9, fontWeight: 800, color: "white" }}>{i + 1}</Typography>
            </Box>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary" }}>{step}</Typography>
          </Box>
        ))}
      </Box>
      <Button variant="contained" onClick={onCreate}
        startIcon={<AddIcon />}
        sx={{
          borderRadius: "10px", textTransform: "none", fontWeight: 600,
          bgcolor: "primary.main", "&:hover": { bgcolor: "primary.dark" },
          boxShadow: "0 4px 12px rgba(79,70,229,0.25)",
        }}>
        Create your first project
      </Button>
    </Box>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "name" | "chunks">("newest");

  const load = useCallback(async () => {
    try { const res = await listProjects(); setProjects(res.projects); }
    catch {}
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

  const filteredProjects = useMemo(() => {
    let list = [...projects];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    if (sort === "newest") list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sort === "oldest") list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "chunks") list.sort((a, b) => (b.chunks ?? 0) - (a.chunks ?? 0));
    return list;
  }, [projects, search, sort]);

  return (
    <>
      {/* Top nav */}
      <Box sx={{
        position: "sticky", top: 0, zIndex: 10,
        bgcolor: "background.paper",
        borderBottom: "1px solid", borderBottomColor: "divider",
        backdropFilter: "blur(12px)",
      }}>
        <Box sx={{ maxWidth: 1200, mx: "auto", px: 4, py: "14px", display: "flex", alignItems: "center", gap: 2 }}>
          {/* Brand */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mr: 2 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: "10px", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BoltIcon sx={{ fontSize: 18, color: "white" }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 14, color: "text.primary", lineHeight: 1.1 }}>QA Intelligence</Typography>
              <Typography sx={{ fontSize: 10, color: "text.disabled", fontWeight: 500 }}>Three-Brain Architecture</Typography>
            </Box>
          </Box>

          {/* Search */}
          <Box sx={{
            flex: 1, maxWidth: 360,
            display: "flex", alignItems: "center", gap: 1,
            bgcolor: "background.default",
            border: "1px solid", borderColor: "divider",
            borderRadius: "10px", px: 1.5, py: "7px",
            "&:focus-within": { borderColor: "primary.main", bgcolor: "background.paper" },
            transition: "all 0.15s",
          }}>
            <SearchIcon sx={{ fontSize: 16, color: "text.disabled" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              style={{
                border: "none", outline: "none", background: "transparent",
                fontSize: 13, color: "inherit", flex: 1,
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            />
            {search && (
              <Box component="button" onClick={() => setSearch("")} sx={{ border: "none", bgcolor: "transparent", cursor: "pointer", color: "text.disabled", p: 0, display: "flex", alignItems: "center", fontSize: 14 }}>✕</Box>
            )}
          </Box>

          <Box sx={{ flex: 1 }} />

          {/* Actions */}
          <ThemeToggle />
          <Button
            variant="contained"
            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            onClick={() => setDialogOpen(true)}
            sx={{
              borderRadius: "10px", textTransform: "none", fontWeight: 600,
              fontSize: 13, px: 2,
              bgcolor: "primary.main", "&:hover": { bgcolor: "primary.dark" },
              boxShadow: "0 2px 8px rgba(79,70,229,0.25)",
            }}
          >
            New Project
          </Button>
        </Box>
      </Box>

      <Box sx={{ bgcolor: "background.default", minHeight: "100vh" }}>
        <Box sx={{ maxWidth: 1200, mx: "auto", px: 4, py: 4 }}>

          {/* KPI strip — only when projects exist */}
          {projects.length > 0 && <KpiStrip projects={projects} />}

          {/* Section header */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ width: 4, height: 20, borderRadius: "999px", bgcolor: "primary.main" }} />
              <Typography sx={{ fontWeight: 700, fontSize: 15, color: "text.primary" }}>
                Projects
              </Typography>
              {!loading && (
                <Box sx={{ px: "8px", py: "2px", borderRadius: "6px", bgcolor: "primary.main" + "12", border: "1px solid", borderColor: "primary.main" + "30" }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: "primary.main" }}>{filteredProjects.length}</Typography>
                </Box>
              )}
            </Box>

            {/* Sort control */}
            {projects.length > 1 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <SortIcon sx={{ fontSize: 15, color: "text.disabled" }} />
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  {(["newest", "name", "chunks"] as const).map((s) => (
                    <Box key={s} component="button" onClick={() => setSort(s)} sx={{
                      px: "10px", py: "5px", borderRadius: "7px", fontSize: 11.5, fontWeight: 600,
                      cursor: "pointer", border: "1px solid",
                      borderColor: sort === s ? "primary.main" : "divider",
                      bgcolor: sort === s ? "primary.main" + "12" : "background.paper",
                      color: sort === s ? "primary.main" : "text.secondary",
                      transition: "all 0.12s",
                    }}>
                      {s === "newest" ? "Newest" : s === "name" ? "A–Z" : "By Size"}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>

          {/* Content */}
          {loading ? (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 16 }}>
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <CircularProgress sx={{ color: "primary.main" }} size={32} />
                <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Loading projects…</Typography>
              </Box>
            </Box>
          ) : filteredProjects.length === 0 && search ? (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
                No projects match "<strong>{search}</strong>"
              </Typography>
              <Button sx={{ mt: 1.5, textTransform: "none", fontSize: 13 }} onClick={() => setSearch("")}>
                Clear search
              </Button>
            </Box>
          ) : projects.length === 0 ? (
            <EmptyState onCreate={() => setDialogOpen(true)} />
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", lg: "repeat(3,1fr)" }, gap: 2 }}>
              {filteredProjects.map((p, i) => (
                <Box key={p.id} sx={{ animation: "fadeUp 0.3s ease both", animationDelay: `${i * 40}ms`, "@keyframes fadeUp": { from: { opacity: 0, transform: "translateY(12px)" }, to: { opacity: 1, transform: "translateY(0)" } } }}>
                  <ProjectCard
                    project={p}
                    index={i}
                    onOpen={() => router.push(`/projects/${p.id}`)}
                    onDelete={() => handleDelete(p.id)}
                  />
                </Box>
              ))}

              {/* Add new */}
              <Box component="button" onClick={() => setDialogOpen(true)} sx={{
                bgcolor: "background.paper",
                border: "2px dashed", borderColor: "divider",
                borderRadius: "16px",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 1.5, p: 3,
                cursor: "pointer", minHeight: 120,
                color: "text.disabled",
                transition: "all 0.15s",
                "&:hover": { borderColor: "primary.main", color: "primary.main", bgcolor: "primary.main" + "04" },
              }}>
                <Box sx={{ width: 40, height: 40, borderRadius: "12px", border: "2px dashed", borderColor: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AddIcon sx={{ fontSize: 20 }} />
                </Box>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: "inherit" }}>New Project</Typography>
              </Box>
            </Box>
          )}

        </Box>
      </Box>

      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
      />
    </>
  );
}
