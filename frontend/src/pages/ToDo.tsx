import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, PageTitle, Btn, Badge, Input, Select, TextArea, EmptyState, Label } from "../components/ui";

const PRI_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const PRI_COLOR: Record<string, string> = { critical: "var(--accent)", high: "#f87171", medium: "var(--text-secondary)", low: "var(--text-muted)" };
const CATEGORIES = ["All", "Work", "Personal", "School", "Travel", "Health", "Finance"];
const CAT_COLORS: Record<string, string> = { Work: "#60a5fa", Personal: "#a78bfa", School: "#34d399", Travel: "#fbbf24", Health: "#f87171", Finance: "#2dd4bf" };
const COLUMNS = [
  { key: "queued", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

export default function ToDo() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [boardData, setBoardData] = useState<{ tickets: any[]; byProject: Record<string, any[]> } | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [showAdd, setShowAdd] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [catFilter, setCatFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", category: "Personal", project: "General", dueAt: "" });
  const [splitting, setSplitting] = useState<string | null>(null);

  const load = () => {
    api.getTickets({}).then((t) => {
      let filtered = t;
      if (statusFilter === "active") filtered = filtered.filter((x: any) => x.status !== "done");
      else if (statusFilter !== "all") filtered = filtered.filter((x: any) => x.status === statusFilter);
      if (catFilter !== "All") filtered = filtered.filter((x: any) => x.category === catFilter);
      filtered.sort((a: any, b: any) => {
        const pa = PRI_ORDER[a.priority] ?? 2;
        const pb = PRI_ORDER[b.priority] ?? 2;
        if (pa !== pb) return pa - pb;
        if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setTasks(filtered);
    });
  };

  const loadBoard = () => {
    api.getTicketsBoard().then(setBoardData).catch(() => setBoardData(null));
  };

  useEffect(() => { load(); }, [statusFilter, catFilter]);
  useEffect(() => { if (viewMode === "board") loadBoard(); else loadBoard(); }, [viewMode]);

  const create = async () => {
    if (!form.title.trim()) return;
    await api.createTicket({ ...form, dueAt: form.dueAt || null });
    setForm({ title: "", description: "", priority: "medium", category: form.category, project: form.project || "General", dueAt: "" });
    setShowAdd(false);
    load();
    loadBoard();
  };

  const markDone = async (id: string) => { await api.updateTicket(id, { status: "done" }); load(); loadBoard(); };
  const reopen = async (id: string) => { await api.updateTicket(id, { status: "queued" }); load(); loadBoard(); };
  const setInProgress = async (id: string) => { await api.updateTicket(id, { status: "in_progress" }); load(); loadBoard(); };
  const remove = async (id: string) => { if (confirm("Delete?")) { await api.deleteTicket(id); load(); loadBoard(); } };
  const isOverdue = (t: any) => t.dueAt && new Date(t.dueAt) < new Date() && t.status !== "done";

  const splitTicket = async (id: string) => {
    setSplitting(id);
    try {
      await api.splitTicket(id);
      load();
      loadBoard();
    } catch (e: any) {
      alert(e.message || "Split failed");
    } finally {
      setSplitting(null);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await api.updateTicket(id, { status });
    load();
    loadBoard();
  };

  // Count by category for badges
  const [allTasks, setAllTasks] = useState<any[]>([]);
  useEffect(() => { api.getTickets({}).then(setAllTasks); }, []);
  const catCount = (cat: string) => {
    const active = allTasks.filter((t) => t.status !== "done");
    return cat === "All" ? active.length : active.filter((t) => t.category === cat).length;
  };

  const projects = boardData ? Object.keys(boardData.byProject || {}).sort() : [];
  const boardTickets = (boardData?.tickets || []).filter((t: any) => projectFilter === "All" || (t.project || "General") === projectFilter);

  const TicketCard = ({ t, onStatusChange }: { t: any; onStatusChange?: (s: string) => void }) => (
    <div
      key={t.id}
      className="group rounded-lg border px-3 py-2 mb-2 transition-colors hover:border-[var(--border-hover)]"
      style={{ background: "var(--bg-card)", borderColor: isOverdue(t) ? "rgba(239,68,68,0.3)" : "var(--border)" }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-sm font-medium ${t.status === "done" ? "line-through" : ""}`}
              style={{ color: t.status === "done" ? "var(--text-muted)" : "var(--text-primary)" }}>
              {t.title}
            </span>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PRI_COLOR[t.priority] }} title={t.priority} />
            {t.category && t.category !== "Personal" && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${CAT_COLORS[t.category] || "var(--text-muted)"}15`, color: CAT_COLORS[t.category] || "var(--text-muted)" }}>
                {t.category}
              </span>
            )}
            {t.status === "in_progress" && <Badge color="amber">working</Badge>}
          </div>
          {t.description && <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>{t.description}</p>}
          <div className="flex gap-2 mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
            {t.dueAt && <span style={{ color: isOverdue(t) ? "#f87171" : undefined }}>{new Date(t.dueAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>}
            {t.agent?.name && <span>{t.agent.name}</span>}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 shrink-0">
          {onStatusChange && (
            t.status === "queued" ? (
              <button onClick={() => onStatusChange("in_progress")} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>Start</button>
            ) : t.status === "in_progress" ? (
              <button onClick={() => onStatusChange("done")} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>✓ Done</button>
            ) : null
          )}
          {!t.parentTicketId && (t.description?.length || 0) >= 100 && (
            <button onClick={() => splitTicket(t.id)} disabled={splitting === t.id} className="text-[9px] px-1.5 py-0.5 rounded opacity-60 hover:opacity-100" style={{ color: "var(--accent)" }} title="Split into stories">
              {splitting === t.id ? "…" : "Split"}
            </button>
          )}
          <button onClick={() => remove(t.id)} className="text-[9px] opacity-0 group-hover:opacity-50 hover:!opacity-100" style={{ color: "#f87171" }}>Del</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-5">
        <PageTitle>To Do</PageTitle>
        <div className="flex gap-2">
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {[["list", "List"], ["board", "Board"]].map(([k, label]) => (
              <button key={k} onClick={() => setViewMode(k as any)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ background: viewMode === k ? "var(--accent-bg)" : "transparent", color: viewMode === k ? "var(--accent)" : "var(--text-muted)" }}>
                {label}
              </button>
            ))}
          </div>
          <Btn variant="primary" onClick={() => setShowAdd(!showAdd)}>+ Add task</Btn>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => {
          const count = catCount(cat);
          const isActive = catFilter === cat;
          return (
            <button key={cat} onClick={() => setCatFilter(cat)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors"
              style={{
                background: isActive ? (cat === "All" ? "var(--accent-bg)" : `${CAT_COLORS[cat]}15`) : "var(--bg-input)",
                color: isActive ? (cat === "All" ? "var(--accent)" : CAT_COLORS[cat]) : "var(--text-muted)",
                border: `1px solid ${isActive ? (cat === "All" ? "var(--accent)" : CAT_COLORS[cat] + "40") : "var(--border)"}`,
              }}>
              {cat !== "All" && <span className="w-1.5 h-1.5 rounded-full" style={{ background: CAT_COLORS[cat] }} />}
              {cat}
              {count > 0 && <span className="text-[10px] opacity-60">{count}</span>}
            </button>
          );
        })}
      </div>

      {viewMode === "list" && (
        <>
          {/* Status filter */}
          <div className="flex gap-1.5 mb-4">
            {[["active", "Active"], ["all", "All"], ["done", "Done"]].map(([k, label]) => (
              <button key={k} onClick={() => setStatusFilter(k)} className="px-2.5 py-1 rounded-md text-[10px]"
                style={{ background: statusFilter === k ? "var(--accent-bg)" : "transparent", color: statusFilter === k ? "var(--accent)" : "var(--text-muted)" }}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {viewMode === "board" && projects.length > 0 && (
        <div className="flex gap-2 mb-4">
          <span className="text-xs self-center" style={{ color: "var(--text-muted)" }}>Project:</span>
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="text-xs px-2 py-1 rounded border" style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
            <option value="All">All projects</option>
            {projects.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )}

      {/* Quick add */}
      {showAdd && (
        <Card className="mb-4">
          <div className="space-y-3">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs to be done?" autoFocus
              onKeyDown={(e) => e.key === "Enter" && !form.description && create()} />
            <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Details (optional)" style={{ minHeight: 50 }} />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div>
                <Label>Project</Label>
                <Input value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} placeholder="General" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full">
                  {CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full">
                  <option value="low">Low</option><option value="medium">Medium</option>
                  <option value="high">High</option><option value="critical">Critical</option>
                </Select>
              </div>
              <div>
                <Label>Due date</Label>
                <Input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
              </div>
              <div className="flex items-end gap-2">
                <Btn variant="primary" onClick={create}>Add</Btn>
                <Btn onClick={() => setShowAdd(false)}>Cancel</Btn>
              </div>
            </div>
          </div>
        </Card>
      )}

      {viewMode === "list" && (
        <div className="space-y-1.5">
          {tasks.map((t) => (
            <div key={t.id} className="group flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors hover:border-[var(--border-hover)]"
              style={{ background: "var(--bg-card)", borderColor: isOverdue(t) ? "rgba(239,68,68,0.3)" : "var(--border)" }}>
              <button onClick={() => t.status === "done" ? reopen(t.id) : markDone(t.id)}
                className="mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors"
                style={{ borderColor: t.status === "done" ? "#4ade80" : "var(--border)", background: t.status === "done" ? "#4ade80" : "transparent" }}>
                {t.status === "done" && <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5"><path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${t.status === "done" ? "line-through" : ""}`}
                    style={{ color: t.status === "done" ? "var(--text-muted)" : "var(--text-primary)" }}>
                    {t.title}
                  </span>
                  {t.status !== "done" && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PRI_COLOR[t.priority] }} title={t.priority} />}
                  {(t.project && t.project !== "General") && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>{t.project}</span>
                  )}
                  {t.category && t.category !== "Personal" && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${CAT_COLORS[t.category] || "var(--text-muted)"}15`, color: CAT_COLORS[t.category] || "var(--text-muted)" }}>
                      {t.category}
                    </span>
                  )}
                  {t.status === "in_progress" && <Badge color="amber">working</Badge>}
                </div>
                {t.description && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{t.description}</p>}
                <div className="flex gap-3 mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {t.dueAt && (
                    <span style={{ color: isOverdue(t) ? "#f87171" : "var(--text-muted)" }}>
                      {isOverdue(t) ? "Overdue: " : "Due: "}
                      {new Date(t.dueAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  )}
                  {t.agent?.name && <span>{t.agent.name}</span>}
                </div>
                {t.output && t.status === "done" && (
                  <p className="text-xs mt-1 rounded p-2" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
                    {t.output.slice(0, 150)}{t.output.length > 150 ? "..." : ""}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                {!t.parentTicketId && (t.description?.length || 0) >= 100 && (
                  <button onClick={() => splitTicket(t.id)} disabled={splitting === t.id} className="text-[10px] px-2 py-1 rounded opacity-60 hover:opacity-100" style={{ color: "var(--accent)" }} title="Split into stories">
                    {splitting === t.id ? "…" : "Split"}
                  </button>
                )}
                <button onClick={() => remove(t.id)} className="text-[10px] opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity" style={{ color: "#f87171" }}>Delete</button>
              </div>
            </div>
          ))}
          {tasks.length === 0 && <EmptyState>{statusFilter === "active" ? "No active tasks. You're all caught up!" : "No tasks found."}</EmptyState>}
        </div>
      )}

      {viewMode === "board" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const colTickets = boardTickets.filter((t: any) => t.status === col.key);
            return (
              <div key={col.key} className="rounded-lg border min-h-[200px]" style={{ borderColor: "var(--border)", background: "var(--bg-input)" }}>
                <div className="px-3 py-2 border-b font-medium text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  {col.label} ({colTickets.length})
                </div>
                <div className="p-2 overflow-y-auto max-h-[60vh]">
                  {colTickets.map((t: any) => (
                    <TicketCard key={t.id} t={t} onStatusChange={(s) => updateStatus(t.id, s)} />
                  ))}
                  {colTickets.length === 0 && (
                    <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>No tickets</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
