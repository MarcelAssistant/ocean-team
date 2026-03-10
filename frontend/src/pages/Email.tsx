import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, PageTitle, Btn, Badge, Input, TextArea, Label, EmptyState } from "../components/ui";

export default function Email() {
  const [emails, setEmails] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [tab, setTab] = useState<"inbox" | "sent" | "compose">("inbox");
  const [syncing, setSyncing] = useState(false);
  const [configured, setConfigured] = useState(true);

  // Compose
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);

  const load = () => {
    const direction = tab === "sent" ? "outbound" : "inbound";
    api.getEmails({ direction }).then(setEmails).catch(() => setConfigured(false));
  };
  useEffect(() => { if (tab !== "compose") load(); }, [tab]);

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await api.syncEmails();
      if (r.success) load();
      else alert(r.error || "Sync failed");
    } finally { setSyncing(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this email?")) return;
    await api.deleteEmail(id);
    if (selected?.id === id) setSelected(null);
    load();
  };

  const sendMail = async () => {
    if (!to.trim() || !subject.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      const r = await api.sendNewEmail(to, subject, body);
      if (r.success) {
        setSendResult({ ok: true, t: "Sent!" });
        setTo(""); setSubject(""); setBody("");
      } else {
        setSendResult({ ok: false, t: r.error });
      }
    } catch (e: any) { setSendResult({ ok: false, t: e.message }); }
    finally { setSending(false); }
  };

  const openEmail = async (e: any) => {
    const full = await api.getEmail(e.id);
    setSelected(full);
  };

  const replyTo = (email: any) => {
    setTo(email.from.replace(/.*</, "").replace(/>.*/, ""));
    setSubject(`Re: ${email.subject}`);
    setBody(`\n\n--- Original message ---\n${email.body.slice(0, 500)}`);
    setTab("compose");
    setSelected(null);
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-5">
        <PageTitle>Email</PageTitle>
        <div className="flex gap-2">
          {tab === "inbox" && <Btn onClick={sync} disabled={syncing}>{syncing ? "Syncing..." : "Sync inbox"}</Btn>}
          <Btn variant="primary" onClick={() => { setTab("compose"); setSelected(null); setSendResult(null); }}>Compose</Btn>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 mb-5 border-b" style={{ borderColor: "var(--border)" }}>
        {([["inbox", "Inbox"], ["sent", "Sent"], ["compose", "Compose"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setSelected(null); }}
            className="px-4 py-2 text-xs font-medium relative"
            style={{ color: tab === k ? "var(--accent)" : "var(--text-muted)" }}>
            {label}
            {tab === k && <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "var(--accent)" }} />}
          </button>
        ))}
      </div>

      {/* Compose */}
      {tab === "compose" && (
        <Card className="max-w-2xl">
          <div className="space-y-3">
            <div><Label>To</Label><Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@example.com" autoFocus /></div>
            <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" /></div>
            <div><Label>Message</Label><TextArea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message..." style={{ minHeight: 150 }} /></div>
            {sendResult && <p className="text-xs" style={{ color: sendResult.ok ? "#4ade80" : "#f87171" }}>{sendResult.t}</p>}
            <Btn variant="primary" onClick={sendMail} disabled={sending || !to.trim() || !subject.trim()}>
              {sending ? "Sending..." : "Send"}
            </Btn>
          </div>
        </Card>
      )}

      {/* Email list + reader */}
      {tab !== "compose" && (
        <div className="flex gap-4" style={{ minHeight: 400 }}>
          {/* List */}
          <div className="w-80 shrink-0 space-y-1 overflow-auto" style={{ maxHeight: "calc(100vh - 250px)" }}>
            {emails.map((e) => (
              <div key={e.id} onClick={() => openEmail(e)}
                className="rounded-lg border px-3 py-2.5 cursor-pointer transition-colors hover:border-[var(--border-hover)]"
                style={{
                  background: selected?.id === e.id ? "var(--accent-bg)" : "var(--bg-card)",
                  borderColor: selected?.id === e.id ? "var(--accent)" : "var(--border)",
                }}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium truncate" style={{ color: e.isRead ? "var(--text-secondary)" : "var(--text-primary)" }}>
                    {tab === "inbox" ? (e.from.split("<")[0].trim() || e.from) : e.to}
                  </span>
                  <span className="text-[9px] shrink-0 ml-2" style={{ color: "var(--text-muted)" }}>
                    {new Date(e.date).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="text-[11px] truncate" style={{ color: e.isRead ? "var(--text-muted)" : "var(--text-primary)" }}>{e.subject}</p>
                <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{e.body.slice(0, 80)}</p>
                {!e.isRead && <span className="inline-block w-1.5 h-1.5 rounded-full mt-1" style={{ background: "var(--accent)" }} />}
              </div>
            ))}
            {emails.length === 0 && (
              <EmptyState>{tab === "inbox" ? "No emails. Click 'Sync inbox' to check." : "No sent emails."}</EmptyState>
            )}
          </div>

          {/* Reader */}
          <div className="flex-1 min-w-0">
            {selected ? (
              <Card>
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>{selected.subject}</h3>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {tab === "inbox" ? `From: ${selected.from}` : `To: ${selected.to}`}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {new Date(selected.date).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-3">
                    {tab === "inbox" && <Btn onClick={() => replyTo(selected)} style={{ padding: "4px 12px", fontSize: 11 }}>Reply</Btn>}
                    <button onClick={() => remove(selected.id)} className="text-[10px]" style={{ color: "#f87171" }}>Delete</button>
                  </div>
                </div>

                {/* Attachments */}
                {selected.attachments && selected.attachments !== "[]" && (
                  <div className="mb-3">
                    {JSON.parse(selected.attachments).map((a: any, i: number) => (
                      <span key={i} className="inline-block text-[10px] px-2 py-0.5 rounded mr-1 mb-1" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
                        📎 {a.name} ({(a.size / 1024).toFixed(0)}KB)
                      </span>
                    ))}
                  </div>
                )}

                <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {selected.body}
                </div>
              </Card>
            ) : (
              <div className="flex items-center justify-center h-full" style={{ color: "var(--text-muted)" }}>
                <p className="text-sm">Select an email to read</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
