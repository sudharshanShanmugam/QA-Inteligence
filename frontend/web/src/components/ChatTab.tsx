"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Typography } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import SendIcon from "@mui/icons-material/Send";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import ReactMarkdown from "react-markdown";
import { chatWithProject, ChatMessage } from "@/lib/api";

const SUGGESTED_QUESTIONS = [
  { icon: "📄", text: "What document types can I upload?" },
  { icon: "🎯", text: "Which docs give the most accurate results?" },
  { icon: "📋", text: "What should my BRD include for best coverage?" },
  { icon: "🔗", text: "Do I need an API contract for API test cases?" },
];

export default function ChatTab({
  projectId,
  context,
  onMessageComplete,
}: {
  projectId: string;
  context: string;
  onMessageComplete?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const prevContextRef = useRef<string>("");
  useEffect(() => {
    if (context && context !== prevContextRef.current) {
      setMessages([]);
      prevContextRef.current = context;
    }
  }, [context]);

const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || streaming) return;
    setInput("");
    const userMsg: ChatMessage = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      await chatWithProject(projectId, msg, [...messages, userMsg], context, (token) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: updated[updated.length - 1].content + token,
          };
          return updated;
        });
      });
    } catch (e: any) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: `Error: ${e.message}` };
        return updated;
      });
    } finally {
      setStreaming(false);
      textareaRef.current?.focus();
      onMessageComplete?.();
    }
  };

  return (
    <Box sx={{
      display: "flex", flexDirection: "column",
      height: "100%",
      bgcolor: "white",
      overflow: "hidden",
    }}>


      {/* ── Messages ── */}
      <Box sx={{
        flex: 1, overflowY: "auto",
        px: 2.5, py: 2,
        display: "flex", flexDirection: "column",
        bgcolor: "#f8fafc",
      }}>

        {/* Empty state */}
        {messages.length === 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, flex: 1, px: 1 }}>

            {/* Icon */}
            <Box sx={{
              width: 44, height: 44, borderRadius: "14px",
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 16px rgba(79,70,229,0.25)",
            }}>
              <SmartToyIcon sx={{ fontSize: 22, color: "white" }} />
            </Box>

            {/* Heading */}
            <Box sx={{ textAlign: "center" }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "text.primary", mb: 0.5 }}>
                Ask about your documents
              </Typography>
              <Typography sx={{ fontSize: 10.5, color: "text.disabled", lineHeight: 1.7, maxWidth: 260 }}>
                Upload docs in the Ingest tab first — then ask how they improve your test coverage.
              </Typography>
            </Box>

            {/* Suggested questions */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, width: "100%", maxWidth: 290 }}>
              {SUGGESTED_QUESTIONS.map((q) => (
                <Box
                  key={q.text}
                  component="button"
                  onClick={() => send(q.text)}
                  sx={{
                    display: "flex", alignItems: "center", gap: 1.5,
                    px: "14px", py: "9px", borderRadius: "12px",
                    border: "1px solid", borderColor: "divider",
                    bgcolor: "background.paper",
                    cursor: "pointer", transition: "all 0.15s",
                    textAlign: "left",
                    "&:hover": {
                      bgcolor: "primary.main" + "08",
                      borderColor: "primary.main" + "40",
                      boxShadow: "0 2px 8px rgba(99,102,241,0.1)",
                    },
                  }}
                >
                  <Typography sx={{ fontSize: 14, lineHeight: 1 }}>{q.icon}</Typography>
                  <Typography sx={{ fontSize: 10.5, fontWeight: 500, color: "text.secondary", lineHeight: 1.4 }}>
                    {q.text}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Messages */}
        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <Box
              key={i}
              sx={{
                display: "flex",
                flexDirection: isUser ? "row-reverse" : "row",
                gap: 1,
                mb: 2,
                animation: "fadeSlide 0.25s ease both",
                "@keyframes fadeSlide": {
                  from: { opacity: 0, transform: "translateY(10px)" },
                  to: { opacity: 1, transform: "translateY(0)" },
                },
              }}
            >
              {/* Avatar */}
              <Box sx={{
                width: 26, height: 26, borderRadius: "8px", flexShrink: 0, mt: "18px",
                display: "flex", alignItems: "center", justifyContent: "center",
                ...(isUser
                  ? { bgcolor: "#eef2ff", border: "1px solid #c7d2fe" }
                  : {
                      background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                      boxShadow: "0 2px 10px rgba(79,70,229,0.25)",
                    }
                ),
              }}>
                {isUser
                  ? <PersonIcon sx={{ fontSize: 13, color: "#4f46e5" }} />
                  : <SmartToyIcon sx={{ fontSize: 13, color: "white" }} />
                }
              </Box>

              {/* Bubble + label */}
              <Box sx={{ maxWidth: "76%", display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Typography sx={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.03em",
                  color: isUser ? "#4f46e5" : "#94a3b8",
                  px: 0.5, textAlign: isUser ? "right" : "left",
                }}>
                  {isUser ? "You" : "QA Assistant"}
                </Typography>
                <Box sx={{
                  px: 2, py: 1.25,
                  borderRadius: isUser ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                  ...(isUser
                    ? {
                        background: "linear-gradient(135deg, #4f46e5, #6366f1)",
                        boxShadow: "0 4px 14px rgba(79,70,229,0.25)",
                      }
                    : {
                        bgcolor: "white",
                        border: "1px solid #e2e8f0",
                        borderLeft: "3px solid #6366f1",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                      }
                  ),
                }}>
                  {isUser ? (
                    <Typography sx={{ fontSize: 10.5, lineHeight: 1.7, color: "white", whiteSpace: "pre-wrap" }}>
                      {msg.content}
                    </Typography>
                  ) : (
                    <Box sx={{
                      fontSize: 10.5, lineHeight: 1.7, color: "#1e293b",
                      "& p": { m: 0, mb: 1, "&:last-child": { mb: 0 } },
                      "& strong": { fontWeight: 700, color: "#0f172a" },
                      "& em": { fontStyle: "italic" },
                      "& ul, & ol": { pl: 2, mb: 1, mt: 0.5 },
                      "& li": { mb: 0.25 },
                      "& h1, & h2, & h3": { fontWeight: 700, color: "#0f172a", mt: 1.5, mb: 0.75, "&:first-of-type": { mt: 0 } },
                      "& h1": { fontSize: 12.5 },
                      "& h2": { fontSize: 11.5 },
                      "& h3": { fontSize: 11 },
                      "& code": {
                        fontFamily: "monospace", fontSize: 10,
                        bgcolor: "#f1f5f9", border: "1px solid #e2e8f0",
                        borderRadius: "4px", px: "4px", py: "1px",
                      },
                      "& pre": {
                        bgcolor: "#0f172a", borderRadius: "8px",
                        p: 1.5, mb: 1, overflow: "auto",
                        "& code": { bgcolor: "transparent", border: "none", color: "#e2e8f0", fontSize: 10, p: 0 },
                      },
                      "& table": {
                        width: "100%", borderCollapse: "collapse", mb: 1, fontSize: 10,
                      },
                      "& th": {
                        bgcolor: "#f1f5f9", fontWeight: 700, color: "#374151",
                        px: 1.5, py: 1, border: "1px solid #e2e8f0", textAlign: "left",
                      },
                      "& td": { px: 1.5, py: 1, border: "1px solid #e2e8f0", color: "#475569" },
                      "& blockquote": {
                        borderLeft: "3px solid #a5b4fc", pl: 2, ml: 0,
                        color: "#64748b", fontStyle: "italic",
                      },
                      "& hr": { border: "none", borderTop: "1px solid #e2e8f0", my: 1.5 },
                    }}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                      {streaming && i === messages.length - 1 && (
                        <Box component="span" sx={{
                          display: "inline-block", width: 7, height: 16,
                          bgcolor: "#6366f1", borderRadius: "2px", ml: "3px", mb: "-3px",
                          animation: "blink 0.9s step-end infinite",
                          "@keyframes blink": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0 } },
                        }} />
                      )}
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}

        <div ref={bottomRef} />
      </Box>

      {/* ── Input ── */}
      <Box sx={{
        px: 2.5, py: 1.5,
        bgcolor: "white",
        borderTop: "1px solid #f1f5f9",
        flexShrink: 0,
      }}>
        <Box sx={{
          display: "flex", gap: 2, alignItems: "center",
          bgcolor: "#f8fafc",
          border: "1.5px solid #e2e8f0",
          borderRadius: "14px",
          px: 2, py: 1,
          transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
          "&:focus-within": {
            borderColor: "#a5b4fc",
            bgcolor: "white",
            boxShadow: "0 0 0 4px rgba(99,102,241,0.08)",
          },
        }}>
          <input
            ref={textareaRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about your docs or test coverage…"
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontSize: 10.5, lineHeight: 1.6, color: "#1e293b",
              fontFamily: "Inter, system-ui, sans-serif",
              padding: 0, margin: 0,
            }}
          />
          <Box
            component="button"
            onClick={() => send(input)}
            disabled={streaming || !input.trim()}
            sx={{
              width: 32, height: 32, borderRadius: "10px", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "none",
              cursor: streaming || !input.trim() ? "not-allowed" : "pointer",
              background: streaming
                ? "#818cf8"
                : !input.trim()
                ? "#e2e8f0"
                : "linear-gradient(135deg, #4f46e5, #6366f1)",
              boxShadow: !streaming && input.trim() ? "0 4px 14px rgba(79,70,229,0.35)" : "none",
              transition: "all 0.2s",
              "&:hover": {
                background: streaming
                  ? "#818cf8"
                  : !input.trim()
                  ? "#e2e8f0"
                  : "linear-gradient(135deg, #4338ca, #4f46e5)",
                boxShadow: !streaming && input.trim() ? "0 6px 20px rgba(79,70,229,0.4)" : "none",
              },
            }}
          >
            {streaming
              ? <ElectricBoltIcon sx={{ fontSize: 18, color: "white", animation: "spin 1s linear infinite", "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } } }} />
              : <SendIcon sx={{ fontSize: 18, color: input.trim() ? "white" : "#94a3b8" }} />
            }
          </Box>
        </Box>
        <Typography sx={{ fontSize: 9.5, color: "#cbd5e1", mt: 1.5, textAlign: "center" }}>
          QA &amp; document questions only · Press Enter to send
        </Typography>
      </Box>
    </Box>
  );
}
