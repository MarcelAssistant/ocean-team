import { useState, useEffect } from "react";
import { Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { api } from "../api";
import ToDo from "./ToDo";
import Calendar from "./Calendar";
import Email from "./Email";
import Notes from "./Notes";
import Automations from "./Automations";
import Characters from "./Characters";
import { Card, Btn, Badge, Input, Label } from "../components/ui";

// Built-in tools (always available)
const BUILTIN_TOOLS = [
  { id: "todo", label: "To Do", path: "todo" },
  { id: "calendar", label: "Calendar", path: "calendar" },
  { id: "email", label: "Email", path: "email" },
  { id: "notes", label: "Notes", path: "notes" },
  { id: "characters", label: "Characters", path: "characters" },
  { id: "automations", label: "Automations", path: "automations" },
];

export default function Tools() {
  const location = useLocation();
  const isRoot = location.pathname === "/tools" || location.pathname === "/tools/";
  const [modules, setModules] = useState<any[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState<Record<string, string>>({});

  const loadModules = () => api.getModules().then(setModules).catch(() => {});
  useEffect(() => { loadModules(); }, []);

  const install = async (slug: string) => {
    setActing(slug);
    try { const r = await api.installModule(slug); if (r.success && r.needsConfig) openConfig(slug); loadModules(); }
    finally { setActing(null); }
  };
  const uninstall = async (slug: string) => {
    if (!confirm("Uninstall? Its agents and tasks will be removed.")) return;
    setActing(slug);
    try { await api.uninstallModule(slug); loadModules(); } finally { setActing(null); }
  };
  const openConfig = (slug: string) => {
    const mod = modules.find((m) => m.slug === slug);
    if (!mod) return;
    const form: Record<string, string> = {};
    for (const f of (mod.manifest?.settings || [])) form[f.key] = mod.config?.[f.key] || f.default || "";
    setConfigForm(form); setConfiguring(slug);
  };
  const saveConfig = async () => {
    if (!configuring) return; setActing(configuring);
    try { await api.updateModuleConfig(configuring, configForm); await api.activateModule(configuring); setConfiguring(null); loadModules(); }
    catch (e: any) { alert(e.message); } finally { setActing(null); }
  };

  const installed = modules.filter((m) => m.status === "installed" || m.status === "needs_config");
  const available = modules.filter((m) => m.status === "available");
  const configuringMod = modules.find((m) => m.slug === configuring);

  return (
    <div>
      {/* Top navigation — installed tools */}
      <div className="flex gap-0.5 mb-4 border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
        {BUILTIN_TOOLS.map((t) => (
          <NavLink key={t.id} to={`/tools/${t.path}`}
            className="px-3 py-2 text-xs font-medium whitespace-nowrap relative shrink-0"
            style={({ isActive }) => ({ color: isActive ? "var(--accent)" : "var(--text-muted)" })}>
            {({ isActive }) => (<>{t.label}{isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "var(--accent)" }} />}</>)}
          </NavLink>
        ))}
        <div className="w-px mx-1 my-1.5" style={{ background: "var(--border)" }} />
        <NavLink to="/tools" end
          className="px-3 py-2 text-xs font-medium whitespace-nowrap relative shrink-0"
          style={({ isActive }) => ({ color: isActive ? "var(--accent)" : "var(--text-muted)" })}>
          {({ isActive }) => (<>+ Add Tools{isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "var(--accent)" }} />}</>)}
        </NavLink>
      </div>

      {/* Tool content */}
      <Routes>
        <Route path="todo" element={<ToDo />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="email" element={<Email />} />
        <Route path="notes" element={<Notes />} />
        <Route path="characters" element={<Characters />} />
        <Route path="automations" element={<Automations />} />
        <Route index element={
          <div className="max-w-4xl">
            {/* Config panel */}
            {configuring && configuringMod && (
              <Card className="mb-5" style={{ borderColor: "var(--accent)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">{configuringMod.manifest?.icon || "⚙"}</span>
                  <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Configure {configuringMod.name}</h3>
                </div>
                <div className="space-y-3 max-w-md">
                  {(configuringMod.manifest?.settings || []).map((field: any) => (
                    <div key={field.key}>
                      <Label>{field.label}{field.required && <span style={{ color: "var(--accent)" }}> *</span>}</Label>
                      <Input type={field.type === "password" ? "password" : "text"} value={configForm[field.key] || ""} onChange={(e) => setConfigForm({ ...configForm, [field.key]: e.target.value })} placeholder={field.default || ""} />
                      {field.description && <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{field.description}</p>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4"><Btn variant="primary" onClick={saveConfig} disabled={acting === configuring}>{acting === configuring ? "..." : "Save & Activate"}</Btn><Btn onClick={() => setConfiguring(null)}>Cancel</Btn></div>
              </Card>
            )}

            {/* Installed add-ons */}
            {installed.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-medium mb-3" style={{ color: "var(--text-muted)" }}>Installed add-ons ({installed.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {installed.map((m) => (
                    <Card key={m.id}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ background: "var(--accent-bg)" }}>{m.manifest?.icon || m.slug[0].toUpperCase()}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{m.name}</span>
                            {m.status === "needs_config" ? <Badge color="amber">Setup needed</Badge> : <Badge color="green">Active</Badge>}
                          </div>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{m.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            {m.manifest?.settings?.length > 0 && <button onClick={() => openConfig(m.slug)} className="text-[10px] underline" style={{ color: "var(--accent)" }}>Configure</button>}
                            <button onClick={() => uninstall(m.slug)} disabled={acting === m.slug} className="text-[10px] ml-auto" style={{ color: "#f87171" }}>{acting === m.slug ? "..." : "Uninstall"}</button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Available add-ons */}
            <div>
              <h3 className="text-xs font-medium mb-3" style={{ color: "var(--text-muted)" }}>Available add-ons ({available.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {available.map((m) => {
                  const reqCount = m.manifest?.settings?.filter((s: any) => s.required).length || 0;
                  return (
                    <Card key={m.id}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>{m.manifest?.icon || m.slug[0].toUpperCase()}</div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{m.name}</span>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{m.description}</p>
                          {reqCount > 0 && <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{reqCount} required setting{reqCount > 1 ? "s" : ""}</p>}
                          <div className="mt-2">
                            <Btn variant="primary" onClick={() => install(m.slug)} disabled={acting === m.slug} style={{ padding: "4px 12px", fontSize: 11 }}>{acting === m.slug ? "Installing..." : "Install"}</Btn>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
                {available.length === 0 && <p className="text-sm col-span-2 py-8 text-center" style={{ color: "var(--text-muted)" }}>All add-ons installed.</p>}
              </div>
            </div>
          </div>
        } />
      </Routes>
    </div>
  );
}
