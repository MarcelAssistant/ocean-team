import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, PageTitle, Btn, Badge, Input, Select, TextArea, EmptyState, Label } from "../components/ui";

const PRI_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const PRI_COLOR: Record<string, string> = { critical: "var(--accent)", high: "#f87171", medium: "var(--text-secondary)", low: "var(--text-muted)" };
const CATEGORIES = ["All", "Work", "Personal", "School", "Travel", "Health", "Finance"];
const CAT_COLORS: Record<string, string> = { Work: "#60a5fa", Personal: "#a78bfa", School: "#34d399", Travel: "#fbbf24", Health: "#f87171", Finance: "#2dd4bf" };

export default function ToDo() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [catFilter, setCatFilter] = useState("All");
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", category: "Personal", dueAt: "" });

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
  useEffect(() => { load(); }, [statusFilter, catFilter]);

  const create = async () => {
    if (!form.title.trim()) return;
    await api.createTicket({ ...form, dueAt: form.dueAt || null });
    setForm({ title: "", description: "", priority: "medium", category: form.category, dueAt: "" });
    setShowAdd(false);
    load();
  };

  const markDone = async (id: string) => { await api.updateTicket(id, { status: "done" }); load(); };
  const reopen = async (id: string) => { await api.updateTicket(id, { status: "queued" }); load(); };
  const remove = async (id: string) => { if (confirm("Delete?")) { await api.deleteTicket(id); load(); } };
  const isOverdue = (t: any) => t.dueAt && new Date(t.dueAt) < new Date() && t.status !== "done";

  // Count by category for badges
  const [allTasks, setAllTasks] = useState<any[]>([]);
  useEffect(() => { api.getTickets({}).then(setAllTasks); }, []);
  const catCount = (cat: string) => {
    const active = allTasks.filter((t) => t.status !== "done");
    return cat === "All" ? active.length : active.filter((t) => t.category === cat).length;
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <PageTitle>To Do</PageTitle>
        <Btn variant="primary" onClick={() => setShowAdd(!showAdd)}>+ Add task</Btn>
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

      {/* Status filter */}
      <div className="flex gap-1.5 mb-4">
        {[["active", "Active"], ["all", "All"], ["done", "Done"]].map(([k, label]) => (
          <button key={k} onClick={() => setStatusFilter(k)} className="px-2.5 py-1 rounded-md text-[10px]"
            style={{ background: statusFilter === k ? "var(--accent-bg)" : "transparent", color: statusFilter === k ? "var(--accent)" : "var(--text-muted)" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Quick add */}
      {showAdd && (
        <Card className="mb-4">
          <div className="space-y-3">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs to be done?" autoFocus
              onKeyDown={(e) => e.key === "Enter" && !form.description && create()} />
            <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Details (optional)" style={{ minHeight: 50 }} />
            <div className="grid grid-cols-4 gap-2">
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

      {/* Task list */}
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
            <button onClick={() => remove(t.id)} className="text-[10px] opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity" style={{ color: "#f87171" }}>Delete</button>
          </div>
        ))}
        {tasks.length === 0 && <EmptyState>{statusFilter === "active" ? "No active tasks. You're all caught up!" : "No tasks found."}</EmptyState>}
      </div>
    </div>
  );
}
