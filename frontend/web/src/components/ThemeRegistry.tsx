"use client";

import { useState, useMemo } from "react";
import createCache from "@emotion/cache";
import { useServerInsertedHTML } from "next/navigation";
import { CacheProvider } from "@emotion/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { buildTheme } from "@/lib/theme";
import { ThemeModeProvider, useThemeMode } from "@/contexts/ThemeMode";

function MuiThemeWrapper({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeMode();
  const theme = useMemo(() => buildTheme(mode), [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [{ cache, flush }] = useState(() => {
    const _cache = createCache({ key: "mui" });
    _cache.compat = true;
    const prevInsert = _cache.insert.bind(_cache);
    let inserted: string[] = [];
    _cache.insert = (...args: Parameters<typeof prevInsert>) => {
      const serialized = args[1];
      if (_cache.inserted[serialized.name] === undefined) inserted.push(serialized.name);
      return prevInsert(...args);
    };
    const flush = () => { const prev = inserted; inserted = []; return prev; };
    return { cache: _cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) return null;
    let styles = "";
    for (const name of names) styles += cache.inserted[name];
    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <ThemeModeProvider>
        <MuiThemeWrapper>
          {children}
        </MuiThemeWrapper>
      </ThemeModeProvider>
    </CacheProvider>
  );
}
