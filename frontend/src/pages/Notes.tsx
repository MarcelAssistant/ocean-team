import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, PageTitle, Btn, Input, TextArea, EmptyState } from "../components/ui";

export default function Notes() {
  const [notes, setNotes] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", content: "", pinned: false });

  const load = () => api.getNotes().then(setNotes);
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.content.trim()) return;
    await api.createNote(form);
    setForm({ title: "", content: "", pinned: false });
    setEditing(null);
    load();
  };

  const update = async (id: string) => {
    await api.updateNote(id, form);
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    await api.deleteNote(id);
    load();
  };

  const togglePin = async (note: any) => {
    await api.updateNote(note.id, { pinned: !note.pinned });
    load();
  };

  const startEdit = (note: any) => {
    setForm({ title: note.title, content: note.content, pinned: note.pinned });
    setEditing(note.id);
  };

  const startNew = () => {
    setForm({ title: "", content: "", pinned: false });
    setEditing("new");
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <PageTitle>Notes</PageTitle>
        <Btn variant="primary" onClick={startNew}>+ Note</Btn>
      </div>

      {editing && (
        <Card className="mb-5">
          <div className="space-y-3">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title (optional)" />
            <TextArea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Write something..." style={{ minHeight: 100 }} />
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Pin to top</span>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Btn variant="primary" onClick={editing === "new" ? create : () => update(editing)}>
              {editing === "new" ? "Save" : "Update"}
            </Btn>
            <Btn onClick={() => setEditing(null)}>Cancel</Btn>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {notes.map((n) => (
          <Card key={n.id}>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => startEdit(n)}>
                {n.pinned && <span className="text-[10px] mr-1" style={{ color: "var(--accent)" }}>📌</span>}
                {n.title && <span className="text-sm font-medium mr-2" style={{ color: "var(--text-primary)" }}>{n.title}</span>}
                <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                  {n.content.slice(0, 200)}{n.content.length > 200 ? "..." : ""}
                </p>
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  {new Date(n.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="flex gap-2 ml-2 shrink-0">
                <button onClick={() => togglePin(n)} className="text-[10px]" style={{ color: n.pinned ? "var(--accent)" : "var(--text-muted)" }}>
                  {n.pinned ? "Unpin" : "Pin"}
                </button>
                <button onClick={() => remove(n.id)} className="text-[10px] opacity-30 hover:opacity-100" style={{ color: "#f87171" }}>Delete</button>
              </div>
            </div>
          </Card>
        ))}
        {notes.length === 0 && <EmptyState>No notes yet. Click + Note to create one.</EmptyState>}
      </div>
    </div>
  );
}
