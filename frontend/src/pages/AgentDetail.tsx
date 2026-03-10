import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { Card, Btn, Badge, Input, TextArea, Label, Select, EmptyState } from "../components/ui";

type Tab = "config" | "chat" | "memory" | "tickets" | "skills" | "telegram";

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("config");
  const [error, setError] = useState("");
  const load = () => { if (id) api.getAgent(id).then(setAgent).catch((e) => setError(e.message)); };
  useEffect(load, [id]);

  if (error) return <p style={{ color: "#f87171" }}>{error}</p>;
  if (!agent) return <p style={{ color: "var(--text-muted)" }}>Loading...</p>;

  const tabs: { key: Tab; label: string }[] = [
    { key: "config", label: "Config" }, { key: "chat", label: "Chat" }, { key: "memory", label: "Memory" },
    { key: "tickets", label: "Tickets" }, { key: "skills", label: "Skills" }, { key: "telegram", label: "Telegram" },
  ];

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-5">
        <Link to="/settings" className="text-xs" style={{ color: "var(--text-muted)" }}>← Settings</Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <span className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{agent.name}</span>
        <Badge color={agent.enabled ? "green" : "red"}>{agent.enabled ? "Active" : "Off"}</Badge>
      </div>

      <div className="flex gap-0.5 mb-5 border-b" style={{ borderColor: "var(--border)" }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-3 py-2 text-xs font-medium transition-colors relative"
            style={{ color: tab === t.key ? "var(--accent)" : "var(--text-muted)" }}>
            {t.label}
            {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "var(--accent)" }} />}
          </button>
        ))}
      </div>

      {tab === "config" && <ConfigTab agent={agent} onUpdate={load} />}
      {tab === "chat" && <ChatTab agent={agent} />}
      {tab === "memory" && <MemoryTab agent={agent} />}
      {tab === "tickets" && <TicketsTab agent={agent} />}
      {tab === "skills" && <SkillsTab agent={agent} onUpdate={load} />}
      {tab === "telegram" && <TelegramTab agent={agent} />}
    </div>
  );
}

function ConfigTab({ agent, onUpdate }: { agent: any; onUpdate: () => void }) {
  const [form, setForm] = useState({ ...agent, tags: JSON.parse(agent.tags || "[]").join(", ") });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api.updateAgent(agent.id, { name: form.name, description: form.description, role: form.role, mission: form.mission, systemPrompt: form.systemPrompt, model: form.model, temperature: parseFloat(form.temperature), maxTokens: parseInt(form.maxTokens), enabled: form.enabled, tags: form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) });
      onUpdate();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3 max-w-xl">
      <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Role</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
        <div><Label>Mission</Label><Input value={form.mission} onChange={(e) => setForm({ ...form, mission: e.target.value })} /></div>
      </div>
      <div><Label>System Prompt</Label><TextArea value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} style={{ minHeight: 120 }} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Model</Label>
          <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="w-full rounded-md border px-3 py-2 text-sm" style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
            <optgroup label="Venice (uncensored)">
              <option value="venice-uncensored">Dolphin Mistral 24B (uncensored)</option>
              <option value="llama-3.3-70b">llama-3.3-70b (with tools)</option>
            </optgroup>
            <optgroup label="OpenAI">
              <option value="gpt-4o-mini">gpt-4o-mini</option>
            </optgroup>
            <optgroup label="Higher (when necessary)">
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4-turbo">gpt-4-turbo</option>
            </optgroup>
          </select>
        </div>
        <div><Label>Temperature</Label><Input type="number" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} /></div>
        <div><Label>Max Tokens</Label><Input type="number" value={form.maxTokens} onChange={(e) => setForm({ ...form, maxTokens: e.target.value })} /></div>
      </div>
      <div><Label>Tags</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="comma-separated" /></div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="rounded" />
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Enabled</span>
      </div>
      <Btn variant="primary" onClick={save} disabled={saving}>{saving ? "..." : "Save"}</Btn>
    </div>
  );
}

function ChatTab({ agent }: { agent: any }) {
  const [convs, setConvs] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getConversations(agent.id).then((c) => { setConvs(c); if (c.length) selectConv(c[0]); });
  }, [agent.id]);

  const selectConv = async (c: any) => { setActiveConv(c); setMessages(await api.getMessages(c.id)); };
  const newConv = async () => { const c = await api.createConversation(agent.id); setConvs([c, ...convs]); setActiveConv(c); setMessages([]); };

  const send = async () => {
    if (!input.trim() || !activeConv || sending) return;
    const msg = input; setInput("");
    setMessages((p) => [...p, { id: "t", role: "user", content: msg, createdAt: new Date().toISOString() }]);
    setSending(true);
    try {
      await api.chat(agent.id, activeConv.id, msg);
      setMessages(await api.getMessages(activeConv.id));
      setConvs(await api.getConversations(agent.id));
    } catch (e: any) {
      setMessages((p) => [...p, { id: "e", role: "assistant", content: `Error: ${e.message}` }]);
    } finally { setSending(false); }
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  return (
    <div className="flex gap-3" style={{ height: "calc(100vh - 200px)" }}>
      {/* Conversations list */}
      <div className="w-48 rounded-lg border overflow-auto" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
        <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
          <button onClick={newConv} className="w-full text-xs py-1.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}>+ New</button>
        </div>
        <div className="p-1">
          {convs.map((c) => (
            <button key={c.id} onClick={() => selectConv(c)}
              className="w-full text-left px-2 py-1.5 rounded text-xs truncate"
              style={{ background: activeConv?.id === c.id ? "var(--accent-bg)" : "transparent", color: activeConv?.id === c.id ? "var(--accent)" : "var(--text-muted)" }}>
              {c.title}
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col rounded-lg border" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
        {!activeConv ? (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>Select or create a conversation</div>
        ) : (
          <>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={m.id || i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[75%] rounded-lg px-3.5 py-2.5 text-sm whitespace-pre-wrap"
                    style={{ background: m.role === "user" ? "var(--accent-bg)" : "var(--bg-input)", color: m.role === "user" ? "var(--accent)" : "var(--text-secondary)" }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {sending && <div className="text-xs" style={{ color: "var(--text-muted)" }}>Thinking...</div>}
              <div ref={endRef} />
            </div>
            <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="Message..." disabled={sending}
                  className="flex-1 rounded-md border px-3 py-2 text-sm"
                  style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                <Btn variant="primary" onClick={send} disabled={sending || !input.trim()}>Send</Btn>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MemoryTab({ agent }: { agent: any }) {
  const [memories, setMemories] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [type, setType] = useState("note");
  const load = () => api.getMemory(agent.id).then(setMemories);
  useEffect(() => { load(); }, [agent.id]);
  const add = async () => { if (!content.trim()) return; await api.addMemory(agent.id, { content, type }); setContent(""); load(); };

  return (
    <div className="max-w-2xl">
      <Card className="mb-4">
        <div className="flex gap-2">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="note">Note</option><option value="summary">Summary</option>
          </Select>
          <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Add memory..." className="flex-1" />
          <Btn variant="primary" onClick={add}>Add</Btn>
        </div>
      </Card>
      <div className="space-y-2">
        {memories.map((m) => (
          <Card key={m.id}>
            <div className="flex items-center gap-2 mb-1">
              <Badge color="gray">{m.type}</Badge>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{new Date(m.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{m.content}</p>
          </Card>
        ))}
        {memories.length === 0 && <EmptyState>No memories.</EmptyState>}
      </div>
    </div>
  );
}

function TicketsTab({ agent }: { agent: any }) {
  return (
    <div className="max-w-2xl space-y-2">
      {(agent.tickets || []).map((t: any) => (
        <Card key={t.id}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t.title}</span>
            <Badge color={t.status === "done" ? "green" : t.status === "failed" ? "red" : "blue"}>{t.status}</Badge>
          </div>
          {t.output && <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{t.output.slice(0, 200)}</p>}
        </Card>
      ))}
      {(agent.tickets || []).length === 0 && <EmptyState>No tickets.</EmptyState>}
    </div>
  );
}

function SkillsTab({ agent, onUpdate }: { agent: any; onUpdate: () => void }) {
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const assigned = new Set((agent.agentSkills || []).map((as: any) => as.skillId));
  useEffect(() => { api.getSkills().then(setAllSkills); }, []);

  return (
    <div className="max-w-2xl">
      <h3 className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>Assigned</h3>
      <div className="space-y-1.5 mb-5">
        {(agent.agentSkills || []).map((as: any) => (
          <div key={as.id} className="flex items-center justify-between rounded-md border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
            <span className="text-xs font-mono" style={{ color: "var(--text-primary)" }}>{as.skill.name}</span>
            <button onClick={async () => { await api.removeSkill(agent.id, as.skillId); onUpdate(); }}
              className="text-[10px]" style={{ color: "#f87171" }}>Remove</button>
          </div>
        ))}
        {(agent.agentSkills || []).length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>None</p>}
      </div>
      <h3 className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>Available</h3>
      <div className="space-y-1.5">
        {allSkills.filter((s) => !assigned.has(s.id)).map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
            <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{s.name}</span>
            <button onClick={async () => { await api.assignSkill(agent.id, s.id); onUpdate(); }}
              className="text-[10px]" style={{ color: "#4ade80" }}>Assign</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TelegramTab({ agent }: { agent: any }) {
  const [botStatus, setBotStatus] = useState<any>({ running: false });
  const [code, setCode] = useState<string | null>(null);
  const [pairings, setPairings] = useState<any[]>([]);
  const [gen, setGen] = useState(false);

  useEffect(() => {
    api.telegramStatus().then(setBotStatus);
    api.telegramPairings().then((all) => setPairings(all.filter((p: any) => p.agent.id === agent.id)));
  }, [agent.id]);

  const genCode = async () => { setGen(true); try { const r = await api.telegramPair(agent.id); setCode(r.code); } finally { setGen(false); } };

  if (!botStatus.running) {
    return <Card><p className="text-xs" style={{ color: "var(--text-muted)" }}>Telegram bot not running. Start it in Settings.</p></Card>;
  }

  return (
    <div className="max-w-lg space-y-4">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>@{botStatus.username}</span>
        </div>
        <Btn variant="primary" onClick={genCode} disabled={gen}>{gen ? "..." : "Generate Pairing Code"}</Btn>
        {code && (
          <div className="mt-3 rounded-lg p-4 text-center border" style={{ borderColor: "var(--accent)", background: "var(--accent-bg)" }}>
            <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>/pair</p>
            <p className="text-2xl font-mono font-bold tracking-widest" style={{ color: "var(--accent)" }}>{code}</p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Expires in 10 minutes</p>
          </div>
        )}
      </Card>
      {pairings.length > 0 && (
        <Card>
          <h4 className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>Paired chats</h4>
          {pairings.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-1.5">
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{p.chatTitle || p.telegramChatId}</span>
              <button onClick={async () => { await api.telegramUnpair(p.id); const all = await api.telegramPairings(); setPairings(all.filter((x: any) => x.agent.id === agent.id)); }}
                className="text-[10px]" style={{ color: "#f87171" }}>Remove</button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
