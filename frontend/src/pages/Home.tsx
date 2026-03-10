import { useEffect, useState, useRef } from "react";
import { api } from "../api";
import { Badge, Btn } from "../components/ui";
import { Link } from "react-router-dom";

export default function Home() {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("Ocean");
  const [convs, setConvs] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dash, setDash] = useState<any>(null);
  const [weather, setWeather] = useState<any>(null);
  const [editingCity, setEditingCity] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    api.checkUpdate().then((r) => setUpdateAvailable(!r.upToDate && !r.error)).catch(() => {});
    api.getAgents().then(async (agents) => {
      const orch = agents.find((a: any) => a.id === "orchestrator-001") || agents.find((a: any) => a.role === "Coordinator");
      if (orch) {
        setAgentId(orch.id);
        setAgentName(orch.name);
        const c = await api.getConversations(orch.id);
        setConvs(c);
        if (c.length > 0) selectConv(c[0]);
        else { const nc = await api.createConversation(orch.id); setConvs([nc]); setActiveConv(nc); }
        setTimeout(() => inputRef.current?.focus(), 200);
      }
    });
    loadDash();
    api.getWeather().then(setWeather).catch(() => {});
    const t = setInterval(loadDash, 30000);
    return () => clearInterval(t);
  }, []);

  const loadDash = () => api.dashboard().then(setDash).catch(() => {});
  const selectConv = async (c: any) => { setActiveConv(c); setMessages(await api.getMessages(c.id)); };
  const newConv = async () => { if (!agentId) return; const c = await api.createConversation(agentId); setConvs([c, ...convs]); setActiveConv(c); setMessages([]); };

  const send = async () => {
    if (!input.trim() || !activeConv || !agentId || sending) return;
    const msg = input; setInput("");
    setMessages((p) => [...p, { id: "t", role: "user", content: msg, createdAt: new Date().toISOString() }]);
    setSending(true);
    try {
      await api.chat(agentId, activeConv.id, msg);
      setMessages(await api.getMessages(activeConv.id));
      setConvs(await api.getConversations(agentId));
      loadDash();
    } catch (e: any) { setMessages((p) => [...p, { id: "e", role: "assistant", content: `Error: ${e.message}` }]); }
    finally { setSending(false); }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !agentId || !activeConv) return;
    e.target.value = "";
    if (file.size > 5 * 1024 * 1024) { alert("Max 5MB."); return; }
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/files/upload", { method: "POST", body: fd, credentials: "include" });
      const result = await res.json();
      if (!res.ok) { setMessages((p) => [...p, { id: "ue", role: "assistant", content: result.error }]); return; }
      setMessages((p) => [...p, { id: "f", role: "user", content: `📎 ${file.name}`, createdAt: new Date().toISOString() }]);
      setSending(true);
      const prompt = `Uploaded file: **${file.name}**\n\nContent:\n---\n${result.textContent.slice(0, 8000)}\n---\n\nSummarize the key info and remember it.`;
      await api.chat(agentId, activeConv.id, prompt);
      const msgs = await api.getMessages(activeConv.id);
      const last = msgs.filter((m: any) => m.role === "assistant").pop();
      if (last) await api.addMemory(agentId, { type: "file", content: `File: ${file.name}\n${last.content.slice(0, 2000)}` });
      setMessages(msgs); setConvs(await api.getConversations(agentId));
    } catch (e: any) { setMessages((p) => [...p, { id: "ue2", role: "assistant", content: `Error: ${e.message}` }]); }
    finally { setUploading(false); setSending(false); }
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (!agentId) return <div className="flex items-center justify-center h-full" style={{ color: "var(--text-muted)" }}>Loading...</div>;

  const sc = (s: string) => ({ finished: "green" as const, done: "green" as const, in_progress: "amber" as const, ready: "blue" as const, queued: "blue" as const, created: "gray" as const, blocked: "red" as const, failed: "red" as const, cancel: "gray" as const }[s] || "gray" as const);
  const priColor = (p: string) => ({ critical: "var(--accent)", high: "#f87171", medium: "var(--text-secondary)", low: "var(--text-muted)" }[p] || "var(--text-muted)");

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Left: Conversations */}
      <div className="hidden md:flex w-48 border-r flex-col shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
        <div className="p-2.5 border-b" style={{ borderColor: "var(--border)" }}>
          <button onClick={newConv} className="w-full text-xs py-2 rounded-md" style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>+ New chat</button>
        </div>
        <div className="flex-1 overflow-auto p-1.5">
          {convs.map((c) => (
            <button key={c.id} onClick={() => selectConv(c)} className="w-full text-left px-2.5 py-2 rounded-md text-xs truncate mb-0.5"
              style={{ background: activeConv?.id === c.id ? "var(--accent-bg)" : "transparent", color: activeConv?.id === c.id ? "var(--accent)" : "var(--text-muted)" }}>
              {c.title}
            </button>
          ))}
        </div>
      </div>

      {/* Center: Dashboard + Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Update banner */}
        {updateAvailable && (
          <div className="shrink-0 px-4 md:px-6 py-2 flex items-center justify-between border-b" style={{ borderColor: "var(--accent)", background: "var(--accent-bg)" }}>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--accent)" }}>A new version is available</span>
            </div>
            <a href="/settings" className="text-xs font-medium underline" style={{ color: "var(--accent)" }}>Update now</a>
          </div>
        )}

        {/* Dashboard widgets */}
        {dash && (
          <div className="shrink-0 border-b px-4 md:px-6 py-3 overflow-x-auto" style={{ borderColor: "var(--border)" }}>
            <div className="flex gap-3 min-w-max">
              {/* Today's tasks */}
              <Link to="/tools/todo" className="shrink-0 w-56 rounded-lg border p-3 hover:border-[var(--border-hover)] transition-colors" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: "var(--text-muted)" }}>Tasks</p>
                {dash.pendingTasks?.slice(0, 3).map((t: any) => (
                  <div key={t.id} className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: priColor(t.priority) }} />
                    <span className="text-[11px] truncate" style={{ color: "var(--text-primary)" }}>{t.title}</span>
                  </div>
                ))}
                {(!dash.pendingTasks || dash.pendingTasks.length === 0) && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>All clear</p>}
                {dash.overdueTasks?.length > 0 && <p className="text-[10px] mt-1" style={{ color: "#f87171" }}>{dash.overdueTasks.length} overdue</p>}
              </Link>

              {/* Today's calendar */}
              <Link to="/tools/calendar" className="shrink-0 w-52 rounded-lg border p-3 hover:border-[var(--border-hover)] transition-colors" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: "var(--text-muted)" }}>Today</p>
                {dash.todayEvents?.slice(0, 3).map((e: any) => (
                  <div key={e.id} className="mb-1">
                    <span className="text-[11px]" style={{ color: "var(--text-primary)" }}>{e.title}</span>
                    <span className="text-[10px] ml-1" style={{ color: "var(--text-muted)" }}>
                      {new Date(e.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
                {(!dash.todayEvents || dash.todayEvents.length === 0) && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>No events</p>}
              </Link>

              {/* Reminders */}
              <div className="shrink-0 w-48 rounded-lg border p-3" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: "var(--text-muted)" }}>Reminders</p>
                {dash.pendingReminders?.slice(0, 3).map((r: any) => (
                  <div key={r.id} className="mb-1">
                    <span className="text-[11px]" style={{ color: "var(--text-primary)" }}>{r.title}</span>
                    <span className="text-[10px] ml-1" style={{ color: "var(--text-muted)" }}>
                      {new Date(r.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
                {(!dash.pendingReminders || dash.pendingReminders.length === 0) && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>None today</p>}
              </div>

              {/* Recently done */}
              <div className="shrink-0 w-48 rounded-lg border p-3" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: "var(--text-muted)" }}>Completed today</p>
                {dash.recentDone?.slice(0, 3).map((t: any) => (
                  <div key={t.id} className="flex items-center gap-1 mb-1">
                    <span className="text-[10px]" style={{ color: "#4ade80" }}>✓</span>
                    <span className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>{t.title}</span>
                  </div>
                ))}
                {(!dash.recentDone || dash.recentDone.length === 0) && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Nothing yet</p>}
              </div>

              {/* Weather — click city to change location */}
              {weather?.configured && weather?.current && (
                <div className="shrink-0 w-44 rounded-lg border p-3" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
                  {editingCity ? (
                    <div className="mb-1">
                      <input value={cityInput} onChange={(e) => setCityInput(e.target.value)} autoFocus
                        placeholder="City name..."
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" && cityInput.trim()) {
                            await api.updateSettings({ user_city: cityInput.trim() });
                            setEditingCity(false);
                            api.getWeather().then(setWeather);
                          }
                          if (e.key === "Escape") setEditingCity(false);
                        }}
                        onBlur={() => setEditingCity(false)}
                        className="w-full rounded border px-1.5 py-0.5 text-[11px]"
                        style={{ background: "var(--bg-input)", borderColor: "var(--accent)", color: "var(--text-primary)" }} />
                    </div>
                  ) : (
                    <p className="text-[10px] font-medium mb-1 cursor-pointer hover:underline"
                      style={{ color: "var(--text-muted)" }}
                      onClick={() => { setCityInput(weather.city || ""); setEditingCity(true); }}
                      title="Click to change location">
                      📍 {weather.city}
                    </p>
                  )}
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{weather.current.temp}°</span>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{weather.current.condition}</span>
                  </div>
                  <div className="mt-1.5 space-y-0.5">
                    {weather.forecast?.slice(0, 2).map((d: any) => (
                      <div key={d.date} className="flex justify-between text-[10px]">
                        <span style={{ color: "var(--text-muted)" }}>{new Date(d.date).toLocaleDateString([], { weekday: "short" })}</span>
                        <span style={{ color: "var(--text-secondary)" }}>{d.low}° / {d.high}°</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {weather && !weather?.current && !weather?.error && (
                <div className="shrink-0 w-44 rounded-lg border p-3 cursor-pointer" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
                  onClick={() => { setCityInput(""); setEditingCity(true); }}>
                  {editingCity ? (
                    <input value={cityInput} onChange={(e) => setCityInput(e.target.value)} autoFocus
                      placeholder="Enter your city..."
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && cityInput.trim()) {
                          await api.updateSettings({ user_city: cityInput.trim() });
                          setEditingCity(false);
                          api.getWeather().then(setWeather);
                        }
                        if (e.key === "Escape") setEditingCity(false);
                      }}
                      onBlur={() => setEditingCity(false)}
                      className="w-full rounded border px-1.5 py-0.5 text-[11px]"
                      style={{ background: "var(--bg-input)", borderColor: "var(--accent)", color: "var(--text-primary)" }} />
                  ) : (
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>📍 Set your city for weather</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chat messages */}
        <div className="flex-1 overflow-auto px-4 md:px-6 py-4">
          {messages.length === 0 && activeConv && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>Brief {agentName} on the next R&D task</p>
                <div className="flex flex-wrap gap-2 justify-center mt-3">
                  {[
                    "Draft an experiment plan to validate feature X",
                    "Break down this spec into independent agent tasks",
                    "Review this design for risks and edge cases",
                    "Summarize blockers across all active tickets",
                  ].map((s) => (
                    <button key={s} onClick={() => setInput(s)} className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:border-[var(--accent)]"
                      style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="max-w-3xl mx-auto space-y-3">
            {messages.map((m, i) => (
              <div key={m.id || i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%]">
                  {m.role === "assistant" && <p className="text-[10px] mb-0.5 px-1" style={{ color: "var(--text-muted)" }}>{agentName}</p>}
                  <div className="rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed"
                    style={{ background: m.role === "user" ? "var(--accent-bg)" : "var(--bg-card)", color: m.role === "user" ? "var(--accent)" : "var(--text-secondary)", border: `1px solid ${m.role === "user" ? "rgba(168,85,247,0.2)" : "var(--border)"}` }}>
                    {m.content}
                  </div>
                </div>
              </div>
            ))}
            {(sending || uploading) && (
              <div className="flex justify-start"><div className="rounded-xl px-4 py-2.5 text-sm border" style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-muted)" }}><span className="animate-pulse">{uploading ? "Processing file..." : "Thinking..."}</span></div></div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        {/* Input bar */}
        {activeConv && (
          <div className="shrink-0 border-t px-4 md:px-6 py-3" style={{ borderColor: "var(--border)" }}>
            <div className="max-w-3xl mx-auto flex gap-2">
              <input type="file" ref={fileRef} onChange={handleFile} className="hidden" accept=".pdf,.xlsx,.xls,.csv,.txt,.md,.json" />
              <button onClick={() => fileRef.current?.click()} disabled={sending || uploading} title="Attach file" className="px-2.5 py-2 rounded-lg border disabled:opacity-30 hover:border-[var(--accent)]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd"/></svg>
              </button>
              <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()} placeholder={`Message ${agentName}...`} disabled={sending || uploading}
                className="flex-1 rounded-lg border px-4 py-2.5 text-sm" style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
              <button onClick={send} disabled={sending || uploading || !input.trim()} className="px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-30" style={{ background: "var(--accent)", color: "#fff" }}>Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
