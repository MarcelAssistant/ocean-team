import { useState, useEffect, useCallback } from "react";
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "./api";
import Home from "./pages/Home";
import Tools from "./pages/Tools";
import Settings from "./pages/Settings";
import AgentDetail from "./pages/AgentDetail";
import Onboarding from "./pages/Onboarding";
import Login from "./pages/Login";

type AuthState = "loading" | "onboarding" | "login" | "authenticated";

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [profile, setProfile] = useState<any>({});
  const checkAuth = async () => {
    try {
      const s = await api.authStatus(); setProfile(s);
      if (!s.onboarded) { setAuthState("onboarding"); return; }
      await api.dashboard(); setAuthState("authenticated");
    } catch (e: any) { setAuthState(e.message === "not_onboarded" ? "onboarding" : "login"); }
  };
  useEffect(() => { checkAuth(); const h = () => setAuthState("login"); window.addEventListener("zeus:logout", h); return () => window.removeEventListener("zeus:logout", h); }, []);
  if (authState === "loading") return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-root)" }}><div className="text-2xl font-semibold" style={{ color: "var(--accent)" }}>OCEAN</div></div>;
  if (authState === "onboarding") return <Onboarding onComplete={() => { checkAuth(); setAuthState("authenticated"); }} />;
  if (authState === "login") return <Login onLogin={() => checkAuth()} />;
  return <Shell onLogout={() => setAuthState("login")} profile={profile} />;
}

const IC = {
  home: <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>,
  tools: <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>,
  set: <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/></svg>,
};

const NAV = [
  { to: "/", label: "Home", icon: IC.home, end: true },
  { to: "/tools", label: "Tools", icon: IC.tools },
  { to: "/settings", label: "Settings", icon: IC.set },
];

function Shell({ onLogout, profile }: { onLogout: () => void; profile: any }) {
  const userName = profile.user_name || "";
  const assistantName = profile.assistant_name || "Ocean";
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isTools = location.pathname.startsWith("/tools");
  const [showSupport, setShowSupport] = useState(false);

  const [notifCount, setNotifCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchR, setSearchR] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const loadNotifCount = useCallback(() => { api.notifCount().then((r) => setNotifCount(r.count)).catch(() => {}); }, []);
  useEffect(() => { loadNotifCount(); const t = setInterval(loadNotifCount, 10000); return () => clearInterval(t); }, []);
  const doSearch = async () => { if (searchQ.length < 2) return; const r = await api.search(searchQ); setSearchR(r.results || []); setShowSearch(true); };

  const sideLink = (n: typeof NAV[0]) => (
    <NavLink key={n.to} to={n.to} end={n.end} className="flex flex-col items-center w-full">
      {({ isActive }) => (
        <div className={`relative flex flex-col items-center gap-0.5 w-full py-2.5 transition-all ${isActive ? "" : "opacity-40 hover:opacity-70"}`}>
          {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-r" style={{ background: "var(--accent)" }} />}
          <span style={{ color: isActive ? "var(--accent)" : "var(--text-secondary)" }}>{n.icon}</span>
          <span className="text-[9px]" style={{ color: isActive ? "var(--accent)" : "var(--text-muted)" }}>{n.label}</span>
        </div>
      )}
    </NavLink>
  );

  return (
    <div className="flex flex-col md:flex-row h-screen" style={{ background: "var(--bg-root)" }}>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[60px] flex-col items-center py-3 border-r shrink-0" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <div className="mb-4 mt-1">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
            {assistantName.charAt(0).toUpperCase()}
          </div>
        </div>
        <nav className="flex-1 flex flex-col items-center w-full gap-0.5">{NAV.map(sideLink)}</nav>
        <div className="mt-auto flex flex-col items-center gap-1 mb-2">
          <button onClick={() => setShowSupport(true)} title="Help" className="opacity-30 hover:opacity-70"><svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" style={{ color: "var(--text-secondary)" }}><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg></button>
          <button onClick={async () => { await api.logout(); onLogout(); }} title="Sign out" className="opacity-30 hover:opacity-70"><svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" style={{ color: "var(--text-secondary)" }}><path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd"/></svg></button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <div className="shrink-0 border-b px-4 py-2 flex items-center gap-3" style={{ background: "var(--bg-root)", borderColor: "var(--border)" }}>
          <span className="text-sm hidden sm:inline" style={{ color: "var(--text-secondary)" }}>
            {userName ? <>{getGreeting()}, <span style={{ color: "var(--text-primary)" }}>{userName}</span></> : getGreeting()}
          </span>
          <div className="flex-1 max-w-xs mx-auto relative">
            <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()} onFocus={() => searchR.length > 0 && setShowSearch(true)}
              placeholder="Search..." className="w-full rounded-md border px-3 py-1.5 text-xs" style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
            {showSearch && searchR.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 rounded-lg border shadow-lg max-h-56 overflow-auto z-50" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
                {searchR.map((r, i) => <div key={i} className="px-3 py-2 text-xs border-b hover:brightness-110" style={{ borderColor: "var(--border)" }} onClick={() => { setShowSearch(false); setSearchQ(""); }}><span className="text-[9px] px-1.5 py-0.5 rounded-full mr-2" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>{r.type}</span><span style={{ color: "var(--text-primary)" }}>{r.title}</span></div>)}
              </div>
            )}
          </div>
          <div className="relative">
            <button onClick={async () => { setNotifs(await api.getNotifications()); setShowNotifs(!showNotifs); }} className="relative p-1" style={{ color: "var(--text-muted)" }}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>
              {notifCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold" style={{ background: "var(--accent)", color: "#fff" }}>{notifCount > 9 ? "9+" : notifCount}</span>}
            </button>
            {showNotifs && (
              <div className="absolute right-0 top-full mt-1 w-72 rounded-lg border shadow-lg max-h-72 overflow-auto z-50" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Notifications</span><button onClick={async () => { await api.readAllNotifs(); loadNotifCount(); setShowNotifs(false); }} className="text-[10px]" style={{ color: "var(--accent)" }}>Mark all read</button></div>
                {notifs.map((n) => <div key={n.id} className="px-3 py-2 border-b" style={{ borderColor: "var(--border)", background: n.read ? "transparent" : "var(--accent-bg)" }} onClick={async () => { await api.readNotif(n.id); loadNotifCount(); setNotifs(notifs.map((x) => x.id === n.id ? { ...x, read: true } : x)); }}><p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{n.title}</p>{n.body && <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{n.body}</p>}</div>)}
                {notifs.length === 0 && <p className="p-4 text-xs text-center" style={{ color: "var(--text-muted)" }}>No notifications</p>}
              </div>
            )}
          </div>
          <span className="text-xs hidden sm:inline" style={{ color: "var(--text-muted)" }}>{assistantName}</span>
        </div>

        <div className={`flex-1 overflow-auto ${isHome ? "" : "p-4 md:p-6"}`} style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tools/*" element={<Tools />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/agents/:id" element={<AgentDetail />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>

        {/* Mobile bottom nav */}
        <nav className="md:hidden shrink-0 border-t flex justify-around py-1" style={{ background: "var(--bg-surface)", borderColor: "var(--border)", paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="flex flex-col items-center py-1 px-3 min-w-[56px]">
              {({ isActive }) => (<><span style={{ color: isActive ? "var(--accent)" : "var(--text-muted)" }}>{n.icon}</span><span className="text-[9px] mt-0.5" style={{ color: isActive ? "var(--accent)" : "var(--text-muted)" }}>{n.label}</span></>)}
            </NavLink>
          ))}
        </nav>
      </main>

      {showSupport && <SupportModal onClose={() => setShowSupport(false)} />}
      {showSearch && <div className="fixed inset-0 z-40" onClick={() => setShowSearch(false)} />}
      {showNotifs && <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />}
    </div>
  );
}

function SupportModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"help" | "ticket">("help");
  const [subject, setSubject] = useState(""); const [desc, setDesc] = useState(""); const [cat, setCat] = useState("General");
  const [sending, setSending] = useState(false); const [result, setResult] = useState<any>(null);
  const submit = async () => { if (!subject.trim() || !desc.trim()) return; setSending(true); try { setResult(await (await fetch("/api/support/ticket", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, description: desc, category: cat }) })).json()); } finally { setSending(false); } };
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full md:max-w-lg rounded-t-2xl md:rounded-xl border p-5 max-h-[85vh] overflow-auto" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Help & Support</h3><button onClick={onClose} className="text-sm p-1" style={{ color: "var(--text-muted)" }}>Close</button></div>
        <div className="flex gap-1 mb-4 border-b" style={{ borderColor: "var(--border)" }}>
          {[["help","Help"],["ticket","Submit Ticket"]].map(([k,l]) => <button key={k} onClick={() => { setTab(k as any); setResult(null); }} className="px-3 py-2 text-xs font-medium relative" style={{ color: tab === k ? "var(--accent)" : "var(--text-muted)" }}>{l}{tab === k && <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "var(--accent)" }} />}</button>)}
        </div>
        {tab === "help" && <div className="space-y-3"><div className="rounded-lg p-3 border" style={{ borderColor: "var(--border)", background: "var(--bg-input)" }}><p className="font-medium mb-2 text-xs" style={{ color: "var(--text-primary)" }}>What you can do</p><ul className="list-disc list-inside space-y-1 text-xs" style={{ color: "var(--text-muted)" }}><li><strong>Home</strong> — Orchestrate conversations with your agent team</li><li><strong>Tools</strong> — Tasks, Calendar, Email, Notes, Automations + more</li><li><strong>Settings</strong> — Connections, agents, orchestration rules, updates</li></ul></div><div className="rounded-lg p-3 border" style={{ borderColor: "var(--border)", background: "var(--bg-input)" }}><p className="font-medium mb-2 text-xs" style={{ color: "var(--text-primary)" }}>Try asking your agents...</p><ul className="space-y-1 text-xs" style={{ color: "var(--text-muted)" }}><li>"Spin up a research plan for feature X"</li><li>"Split this spec into implementation and QA tickets"</li><li>"Summarize all open risks on this project"</li><li>"Design an experiment to validate this assumption"</li></ul></div></div>}
        {tab === "ticket" && <div className="space-y-3"><select value={cat} onChange={(e) => setCat(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }}><option>General</option><option>Bug report</option><option>Feature request</option></select><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full rounded-md border px-3 py-2 text-sm" style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }} /><textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describe..." className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px]" style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }} />{result && <div className="rounded-md p-3 text-xs" style={{ background: result.success ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: result.success ? "#4ade80" : "#f87171" }}>{result.message||result.error}</div>}<button onClick={submit} disabled={sending||!subject.trim()||!desc.trim()} className="w-full py-2.5 rounded-md text-sm font-medium disabled:opacity-30" style={{ background: "var(--accent)", color: "#fff" }}>{sending ? "..." : "Submit"}</button><p className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>Sent to support.ocean@zephyre.com</p></div>}
      </div>
    </div>
  );
}

function getGreeting() { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }
