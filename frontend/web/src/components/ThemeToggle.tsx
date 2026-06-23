"use client";

import { IconButton, Tooltip } from "@mui/material";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import { useThemeMode } from "@/contexts/ThemeMode";

export default function ThemeToggle() {
  const { mode, toggle } = useThemeMode();
  return (
    <Tooltip title={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}>
      <IconButton
        onClick={toggle}
        size="small"
        sx={{
          width: 36,
          height: 36,
          borderRadius: "10px",
          border: "1px solid",
          borderColor: "divider",
          color: "text.secondary",
          bgcolor: "background.paper",
          "&:hover": {
            bgcolor: "action.hover",
            color: "primary.main",
          },
          transition: "all 0.15s",
        }}
      >
        {mode === "light"
          ? <DarkModeIcon sx={{ fontSize: 17 }} />
          : <LightModeIcon sx={{ fontSize: 17 }} />
        }
      </IconButton>
    </Tooltip>
  );
}
