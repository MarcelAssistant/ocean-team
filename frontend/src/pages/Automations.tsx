import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, PageTitle, Btn, Badge, Input, Label, EmptyState } from "../components/ui";

export default function Automations() {
  const [automations, setAutomations] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ what: "", systems: "", frequency: "", dataSource: "", delivery: "" });
  const [tab, setTab] = useState<"auto" | "tasks">("auto");

  const load = () => { api.getAutomations().then(setAutomations); api.getScheduledTasks().then(setTasks); };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.what.trim()) return;
    await api.createAutomation(form);
    setForm({ what: "", systems: "", frequency: "", dataSource: "", delivery: "" });
    setShowCreate(false);
    load();
  };

  const statusColor = (s: string): "blue" | "amber" | "green" | "red" | "purple" | "gray" => {
    const m: Record<string, "blue" | "amber" | "green" | "red" | "purple" | "gray"> = { pending: "blue", processing: "amber", tested: "purple", active: "green", failed: "red" };
    return m[s] || "gray";
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <PageTitle>Automations</PageTitle>
        <Btn variant="primary" onClick={() => setShowCreate(!showCreate)}>+ New</Btn>
      </div>

      <div className="flex gap-1.5 mb-5">
        {[["auto", `Automations (${automations.length})`], ["tasks", `Scheduled (${tasks.length})`]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className="px-3 py-1.5 rounded-md text-xs transition-colors"
            style={{ background: tab === k ? "var(--accent-bg)" : "var(--bg-input)", color: tab === k ? "var(--accent)" : "var(--text-muted)", border: `1px solid ${tab === k ? "var(--accent)" : "var(--border)"}` }}>
            {label}
          </button>
        ))}
      </div>

      {showCreate && (
        <Card className="mb-5">
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Describe what to automate. The orchestrator will set it up.</p>
          <div className="space-y-3">
            <div><Label>What should be done?</Label><Input value={form.what} onChange={(e) => setForm({ ...form, what: e.target.value })} placeholder="e.g. Summarize unread emails every morning" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Systems</Label><Input value={form.systems} onChange={(e) => setForm({ ...form, systems: e.target.value })} placeholder="Email, Slack..." /></div>
              <div><Label>Frequency</Label><Input value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="Daily at 8am" /></div>
              <div><Label>Data source</Label><Input value={form.dataSource} onChange={(e) => setForm({ ...form, dataSource: e.target.value })} placeholder="IMAP inbox" /></div>
              <div><Label>Delivery</Label><Input value={form.delivery} onChange={(e) => setForm({ ...form, delivery: e.target.value })} placeholder="Email me" /></div>
            </div>
          </div>
          <div className="flex gap-2 mt-4"><Btn variant="primary" onClick={create}>Create & Assign</Btn><Btn onClick={() => setShowCreate(false)}>Cancel</Btn></div>
        </Card>
      )}

      {tab === "auto" && (
        <div className="space-y-2">
          {automations.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{a.what}</span>
                    <Badge color={statusColor(a.status)}>{a.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                    {a.systems && <span>Systems: {a.systems}</span>}
                    {a.frequency && <span>Freq: {a.frequency}</span>}
                    {a.dataSource && <span>Source: {a.dataSource}</span>}
                    {a.delivery && <span>Delivery: {a.delivery}</span>}
                  </div>
                  {a.testResult && (
                    <div className="mt-2 rounded p-2 text-[11px]" style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}>
                      {a.testResult.slice(0, 300)}
                    </div>
                  )}
                </div>
                <div className="flex gap-1.5 ml-3">
                  {a.status !== "active" && <Btn variant="ghost" onClick={async () => { await api.testAutomation(a.id); load(); }}>Test</Btn>}
                  {(a.status === "tested" || a.status === "processing") && <Btn variant="ghost" onClick={async () => { await api.confirmAutomation(a.id); load(); }}>Confirm</Btn>}
                  <button onClick={async () => { if (confirm("Delete?")) { await api.deleteAutomation(a.id); load(); } }}
                    className="text-[10px] opacity-30 hover:opacity-100 px-2" style={{ color: "#f87171" }}>Delete</button>
                </div>
              </div>
            </Card>
          ))}
          {automations.length === 0 && <EmptyState>No automations yet.</EmptyState>}
        </div>
      )}

      {tab === "tasks" && (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Card key={t.id}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium font-mono" style={{ color: "var(--text-primary)" }}>{t.name}</span>
                    <Badge color={t.enabled ? "green" : "red"}>{t.enabled ? "Active" : "Paused"}</Badge>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>every {t.intervalMin}min</span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t.description}</p>
                  {t.lastRunAt && <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Last: {new Date(t.lastRunAt).toLocaleString()} — {t.lastResult.slice(0, 80)}</p>}
                </div>
                <button onClick={async () => { await api.updateScheduledTask(t.id, { enabled: !t.enabled }); load(); }}
                  className="text-[10px] px-2 py-1 rounded" style={{ background: t.enabled ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)", color: t.enabled ? "#f87171" : "#4ade80" }}>
                  {t.enabled ? "Pause" : "Resume"}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
