import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, PageTitle, Btn, Input, Label, Badge, EmptyState } from "../components/ui";

export default function Calendar() {
  const [events, setEvents] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [form, setForm] = useState({ title: "", startAt: "", endAt: "", location: "", allDay: false });

  const getWeekDates = () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  };

  const load = () => {
    const { start, end } = getWeekDates();
    api.getEvents(start.toISOString(), end.toISOString()).then(setEvents);
  };
  useEffect(() => { load(); }, [weekOffset]);

  const create = async () => {
    if (!form.title.trim() || !form.startAt) return;
    await api.createEvent(form);
    setForm({ title: "", startAt: "", endAt: "", location: "", allDay: false });
    setShowAdd(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    await api.deleteEvent(id);
    load();
  };

  const { start } = getWeekDates();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = new Date().toDateString();

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <PageTitle>Calendar</PageTitle>
        <div className="flex gap-2">
          <Btn onClick={() => setWeekOffset(weekOffset - 1)}>←</Btn>
          <Btn onClick={() => setWeekOffset(0)}>Today</Btn>
          <Btn onClick={() => setWeekOffset(weekOffset + 1)}>→</Btn>
          <Btn variant="primary" onClick={() => setShowAdd(!showAdd)}>+ Event</Btn>
        </div>
      </div>

      {showAdd && (
        <Card className="mb-5">
          <div className="space-y-3 max-w-md">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Meeting, appointment..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start</Label><Input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></div>
              <div><Label>End (optional)</Label><Input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></div>
            </div>
            <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Optional" /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>All day</span>
            </div>
          </div>
          <div className="flex gap-2 mt-3"><Btn variant="primary" onClick={create}>Add</Btn><Btn onClick={() => setShowAdd(false)}>Cancel</Btn></div>
        </Card>
      )}

      {/* Week view */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((d, i) => {
          const isToday = d.toDateString() === today;
          const dayEvents = events.filter((e) => {
            const eDate = new Date(e.startAt).toDateString();
            return eDate === d.toDateString();
          });

          return (
            <div key={i} className="rounded-lg border p-2 min-h-[140px]" style={{
              background: "var(--bg-card)", borderColor: isToday ? "var(--accent)" : "var(--border)",
            }}>
              <div className="flex items-center gap-1 mb-2">
                <span className="text-xs font-medium" style={{ color: isToday ? "var(--accent)" : "var(--text-muted)" }}>{dayNames[i]}</span>
                <span className={`text-xs ${isToday ? "font-bold" : ""}`} style={{ color: isToday ? "var(--accent)" : "var(--text-secondary)" }}>
                  {d.getDate()}
                </span>
              </div>
              <div className="space-y-1">
                {dayEvents.map((e) => (
                  <div key={e.id} className="group rounded px-1.5 py-1 text-[10px] cursor-pointer hover:brightness-125"
                    style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                    <div className="flex items-center justify-between">
                      <span className="truncate">{e.title}</span>
                      <button onClick={() => remove(e.id)} className="hidden group-hover:block text-[8px]" style={{ color: "#f87171" }}>×</button>
                    </div>
                    {!e.allDay && (
                      <span style={{ color: "var(--text-muted)" }}>
                        {new Date(e.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming list */}
      <div className="mt-5">
        <h3 className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>This week ({events.length} events)</h3>
        <div className="space-y-1.5">
          {events.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-md border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
              <div>
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>{e.title}</span>
                <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>
                  {new Date(e.startAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                  {!e.allDay && ` ${new Date(e.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                </span>
                {e.location && <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>📍 {e.location}</span>}
              </div>
              <button onClick={() => remove(e.id)} className="text-[10px] opacity-30 hover:opacity-100" style={{ color: "#f87171" }}>Delete</button>
            </div>
          ))}
          {events.length === 0 && <EmptyState>No events this week.</EmptyState>}
        </div>
      </div>
    </div>
  );
}
