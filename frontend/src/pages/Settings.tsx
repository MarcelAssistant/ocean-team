import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Card, PageTitle, Btn, Input, Label, Badge, EmptyState } from "../components/ui";

type Tab = "connections" | "agents" | "skills" | "logs" | "access" | "update";

export default function Settings() {
  const [tab, setTab] = useState<Tab>("connections");

  const tabs: { key: Tab; label: string }[] = [
    { key: "connections", label: "Connections" },
    { key: "agents", label: "Agents" },
    { key: "skills", label: "Skills" },
    { key: "logs", label: "Logs" },
    { key: "access", label: "Access" },
    { key: "update", label: "Update" },
  ];

  return (
    <div className="max-w-4xl">
      <PageTitle>Settings</PageTitle>

      <div className="flex gap-0.5 mb-5 border-b" style={{ borderColor: "var(--border)" }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 text-xs font-medium relative transition-colors"
            style={{ color: tab === t.key ? "var(--accent)" : "var(--text-muted)" }}>
            {t.label}
            {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "var(--accent)" }} />}
          </button>
        ))}
      </div>

      {tab === "connections" && <ConnectionsTab />}
      {tab === "agents" && <AgentsTab />}
      {tab === "skills" && <SkillsTab />}
      {tab === "logs" && <LogsTab />}
      {tab === "access" && <AccessTab />}
      {tab === "update" && <UpdateTab />}
    </div>
  );
}

function ConnectionsTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("venice-uncensored");
  const [tgToken, setTgToken] = useState("");
  const [veniceKey, setVeniceKey] = useState("");
  const [veniceModel, setVeniceModel] = useState("wan-2.5-preview-image-to-video");
  const [elevenLabsKey, setElevenLabsKey] = useState("");
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState("");
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [tgStatus, setTgStatus] = useState<any>({ running: false });
  const [tgAction, setTgAction] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      if (s.default_model) setModel(s.default_model);
      if (s.venice_default_video_model) setVeniceModel(s.venice_default_video_model);
      if (s.elevenlabs_default_voice_id) setElevenLabsVoiceId(s.elevenlabs_default_voice_id);
    });
    api.telegramStatus().then(setTgStatus);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const d: Record<string, string> = { default_model: model };
      if (apiKey) d.openai_api_key = apiKey;
      if (tgToken) d.telegram_bot_token = tgToken;
      if (veniceKey) d.venice_api_key = veniceKey;
      if (veniceModel) d.venice_default_video_model = veniceModel;
      if (elevenLabsKey) d.elevenlabs_api_key = elevenLabsKey;
      if (elevenLabsVoiceId) d.elevenlabs_default_voice_id = elevenLabsVoiceId;
      await api.updateSettings(d);
      setApiKey(""); setTgToken(""); setVeniceKey(""); setElevenLabsKey("");
      setSettings(await api.getSettings());
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 max-w-xl">
      <Card>
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>OpenAI</h3>
        <div className="space-y-3">
          <div><Label>API Key</Label><Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={settings.openai_api_key || "sk-..."} /></div>
          <div><Label>Model</Label>
            <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
              <optgroup label="Venice">
                <option value="venice-uncensored">Dolphin Mistral 24B (uncensored)</option>
                <option value="llama-3.3-70b">llama-3.3-70b (with tools)</option>
              </optgroup>
              <optgroup label="OpenAI">
                <option value="gpt-4o-mini">gpt-4o-mini</option>
              </optgroup>
              <optgroup label="Higher (use only when necessary)">
                <option value="gpt-4o">gpt-4o (OpenAI)</option>
                <option value="gpt-4-turbo">gpt-4-turbo (OpenAI)</option>
              </optgroup>
            </select>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Default model for new agents. Ocean (main agent) uses Venice — set Venice API key below.</p>
          </div>
          <div className="flex gap-2 items-center">
            <Btn onClick={async () => { setTesting(true); try { setTestResult(await api.testConnection(model)); } catch (e:any) { setTestResult({ success: false, error: e.message }); } finally { setTesting(false); } }} disabled={testing}>{testing ? "..." : "Test"}</Btn>
            {testResult && <span className="text-xs" style={{ color: testResult.success ? "#4ade80" : "#f87171" }}>{testResult.success ? "Connected" : testResult.error}</span>}
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>Telegram</h3>
        <div className="space-y-3">
          <div><Label>Bot Token</Label><Input type="password" value={tgToken} onChange={(e) => setTgToken(e.target.value)} placeholder={settings.telegram_bot_token || "From @BotFather"} /></div>
          <div className="flex items-center gap-3">
            <Btn onClick={async () => { setTgAction(true); try { if (tgStatus.running) await api.telegramStop(); else await api.telegramStart(); setTgStatus(await api.telegramStatus()); } finally { setTgAction(false); } }} disabled={tgAction}>{tgStatus.running ? "Stop" : "Start Bot"}</Btn>
            <span className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${tgStatus.running ? "bg-green-500" : "bg-gray-600"}`} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>{tgStatus.running ? `@${tgStatus.username}` : "Off"}</span></span>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>Video — Venice AI</h3>
        <div className="space-y-3">
          <div><Label>Venice API Key</Label><Input type="password" value={veniceKey} onChange={(e) => setVeniceKey(e.target.value)} placeholder={settings.venice_api_key ? "••••••••" : "From venice.ai → Settings → API"} /></div>
          <div><Label>Default video model</Label><Input value={veniceModel} onChange={(e) => setVeniceModel(e.target.value)} placeholder="wan-2.5-preview-image-to-video" /></div>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Required for all agents (uncensored). Also used for character image analysis (vision) and video generation.</p>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>Voice — ElevenLabs</h3>
        <div className="space-y-3">
          <div><Label>ElevenLabs API Key</Label><Input type="password" value={elevenLabsKey} onChange={(e) => setElevenLabsKey(e.target.value)} placeholder={settings.elevenlabs_api_key ? "••••••••" : "From elevenlabs.io → Profile → API Key"} /></div>
          <div><Label>Default voice ID</Label><Input value={elevenLabsVoiceId} onChange={(e) => setElevenLabsVoiceId(e.target.value)} placeholder={settings.elevenlabs_default_voice_id || "Optional"} /></div>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Used by voiceover_generate when tool is &quot;elevenlabs&quot;.</p>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>Email</h3>
        <EmailFields settings={settings} />
      </Card>

      <Btn variant="primary" onClick={save} disabled={saving}>{saving ? "..." : "Save All"}</Btn>
    </div>
  );
}

function EmailFields({ settings }: { settings: Record<string, string> }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [imapR, setImapR] = useState<any>(null);
  const [smtpR, setSmtpR] = useState<any>(null);

  useEffect(() => {
    const f: Record<string, string> = {};
    ["email_imap_host","email_imap_port","email_imap_user","email_imap_pass","email_smtp_host","email_smtp_port","email_smtp_user","email_smtp_pass","email_from_address","email_from_name"].forEach((k) => f[k] = settings[k] || "");
    setForm(f);
  }, [settings]);

  const fld = (label: string, key: string, type = "text") => (
    <div><Label>{label}</Label><Input type={type} value={form[key]||""} onChange={(e) => setForm({...form,[key]:e.target.value})} /></div>
  );

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Incoming (IMAP)</p>
        {fld("Host","email_imap_host")}{fld("Port","email_imap_port")}{fld("User","email_imap_user")}{fld("Password","email_imap_pass","password")}
        <div className="flex items-center gap-2">
          <Btn variant="ghost" onClick={async () => setImapR(await api.testImap())}>Test</Btn>
          {imapR && <span className="text-[10px]" style={{ color: imapR.success ? "#4ade80" : "#f87171" }}>{imapR.success ? "OK" : imapR.error}</span>}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Outgoing (SMTP)</p>
        {fld("Host","email_smtp_host")}{fld("Port","email_smtp_port")}{fld("User","email_smtp_user")}{fld("Password","email_smtp_pass","password")}
        {fld("From","email_from_name")}{fld("Address","email_from_address")}
        <div className="flex items-center gap-2">
          <Btn variant="ghost" onClick={async () => setSmtpR(await api.testSmtp())}>Test</Btn>
          {smtpR && <span className="text-[10px]" style={{ color: smtpR.success ? "#4ade80" : "#f87171" }}>{smtpR.success ? "OK" : smtpR.error}</span>}
        </div>
      </div>
      <div className="col-span-2">
        <Btn onClick={async () => { await api.updateSettings(form); }}>Save Email Settings</Btn>
      </div>
    </div>
  );
}

function AgentsTab() {
  const [agents, setAgents] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", mission: "" });

  const load = () => api.getAgents().then(setAgents);
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim()) return;
    await api.createAgent(form);
    setForm({ name: "", role: "", mission: "" });
    setShowCreate(false);
    load();
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Manage your AI team</p>
        <Btn variant="primary" onClick={() => setShowCreate(!showCreate)}>+ Agent</Btn>
      </div>

      {showCreate && (
        <Card className="mb-4">
          <div className="space-y-2">
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Role" value={form.role} onChange={(e) => setForm({...form, role: e.target.value})} />
              <Input placeholder="Mission" value={form.mission} onChange={(e) => setForm({...form, mission: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-2 mt-3"><Btn variant="primary" onClick={create}>Create</Btn><Btn onClick={() => setShowCreate(false)}>Cancel</Btn></div>
        </Card>
      )}

      <div className="space-y-2">
        {agents.map((a) => (
          <Link key={a.id} to={`/settings/agents/${a.id}`}>
            <div className="rounded-lg border p-3 flex items-center justify-between transition-colors hover:border-[var(--border-hover)]" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{a.name}</span>
                  <Badge color={a.enabled ? "green" : "red"}>{a.enabled ? "Active" : "Off"}</Badge>
                  {a.isSystem && <Badge color="purple">System</Badge>}
                  {a.moduleSlug && <Badge color="blue">{a.moduleSlug}</Badge>}
                </div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{a.role} — {a.mission}</p>
              </div>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{a.model}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SkillsTab() {
  const [skills, setSkills] = useState<any[]>([]);
  const [gaps, setGaps] = useState<any[]>([]);
  const load = () => { api.getSkills().then(setSkills); api.getSkillGaps().then(setGaps); };
  useEffect(() => { load(); }, []);

  const unresolvedGaps = gaps.filter((g) => !g.resolved);

  return (
    <div className="max-w-2xl">
      {unresolvedGaps.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-medium mb-2" style={{ color: "var(--accent)" }}>Missing capabilities ({unresolvedGaps.length})</p>
          {unresolvedGaps.map((g) => (
            <Card key={g.id} className="mb-2 border-[rgba(168,85,247,0.2)]">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>{g.skillName}</span>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{g.triggerContext}</p>
                </div>
                <Btn variant="primary" onClick={async () => { await api.generateStub(g.id); load(); }} style={{ padding: "4px 12px", fontSize: 11 }}>Generate</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>Registered skills ({skills.length})</p>
      <div className="space-y-1.5">
        {skills.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono" style={{ color: "var(--text-primary)" }}>{s.name}</span>
              <Badge color={s.enabled ? "green" : "red"}>{s.enabled ? "On" : "Off"}</Badge>
            </div>
            <button onClick={async () => { await api.updateSkill(s.id, { enabled: !s.enabled }); load(); }}
              className="text-[10px]" style={{ color: s.enabled ? "#f87171" : "#4ade80" }}>
              {s.enabled ? "Disable" : "Enable"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [level, setLevel] = useState("");
  const load = () => api.getLogs({ limit: "100", ...(level ? { level } : {}) }).then(setLogs);
  useEffect(() => { load(); }, [level]);

  return (
    <div className="max-w-3xl">
      <div className="flex gap-1.5 mb-3">
        {["", "info", "warn", "error"].map((l) => (
          <button key={l} onClick={() => setLevel(l)} className="px-3 py-1 rounded-md text-xs"
            style={{ background: level === l ? "var(--accent-bg)" : "var(--bg-input)", color: level === l ? "var(--accent)" : "var(--text-muted)", border: `1px solid ${level === l ? "var(--accent)" : "var(--border)"}` }}>
            {l || "All"}
          </button>
        ))}
        <Btn variant="ghost" onClick={load}>Refresh</Btn>
      </div>
      <div className="space-y-1">
        {logs.map((l) => (
          <div key={l.id} className="flex gap-3 py-1.5 text-xs border-b" style={{ borderColor: "var(--border)" }}>
            <span className="shrink-0 w-28" style={{ color: "var(--text-muted)" }}>{new Date(l.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            <Badge color={l.level === "error" ? "red" : l.level === "warn" ? "amber" : "blue"}>{l.level}</Badge>
            <span style={{ color: "var(--text-secondary)" }}>{l.message}</span>
          </div>
        ))}
        {logs.length === 0 && <EmptyState>No logs.</EmptyState>}
      </div>
    </div>
  );
}

function AccessTab() {
  const [vm, setVm] = useState("");
  const [city, setCity] = useState("");
  const [timezone, setTimezone] = useState("");
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confPw, setConfPw] = useState("");
  const [pwMsg, setPwMsg] = useState<any>(null);
  const [locMsg, setLocMsg] = useState<any>(null);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    api.authStatus().then((s) => {
      if (s.vmAddress) setVm(s.vmAddress);
      if (s.user_city) setCity(s.user_city);
      if (s.user_timezone) setTimezone(s.user_timezone);
    });
  }, []);

  const changePw = async () => {
    if (newPw.length < 4) { setPwMsg({ ok: false, t: "Min 4 characters" }); return; }
    if (newPw !== confPw) { setPwMsg({ ok: false, t: "Don't match" }); return; }
    setChanging(true);
    try { await api.changePassword(curPw, newPw); setPwMsg({ ok: true, t: "Changed" }); setCurPw(""); setNewPw(""); setConfPw(""); }
    catch (e: any) { setPwMsg({ ok: false, t: e.message }); }
    finally { setChanging(false); }
  };

  const saveLocation = async () => {
    try {
      await api.updateSettings({ user_city: city, user_timezone: timezone });
      setLocMsg({ ok: true, t: "Location saved" });
    } catch (e: any) { setLocMsg({ ok: false, t: e.message }); }
  };

  return (
    <div className="max-w-sm space-y-4">
      <Card>
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>Location & timezone</h3>
        <div className="space-y-3">
          <div>
            <Label>City</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Paris, New York" />
          </div>
          <div>
            <Label>Timezone</Label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
              {Intl.supportedValuesOf("timeZone").map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
            </select>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Used for reminders, calendar, and weather</p>
          </div>
          {locMsg && <p className="text-xs" style={{ color: locMsg.ok ? "#4ade80" : "#f87171" }}>{locMsg.t}</p>}
          <Btn onClick={saveLocation}>Save location</Btn>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>Remote access</h3>
        <div className="flex gap-2 mb-2">
          <Input value={vm} onChange={(e) => setVm(e.target.value)} placeholder="VM IP" className="flex-1" />
          <Btn onClick={async () => { await api.updateVmAddress(vm); }}>Save</Btn>
        </div>
        {vm && (
          <a href={`http://${vm}:${typeof window !== "undefined" ? (window.location.port || "3000") : "3000"}`} target="_blank" rel="noopener" className="text-sm font-mono" style={{ color: "var(--accent)" }}>
            http://{vm}:{typeof window !== "undefined" ? (window.location.port || "3000") : "3000"}
          </a>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>Change password</h3>
        <div className="space-y-2">
          <Input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="Current" />
          <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New" />
          <Input type="password" value={confPw} onChange={(e) => setConfPw(e.target.value)} placeholder="Confirm" />
          {pwMsg && <p className="text-xs" style={{ color: pwMsg.ok ? "#4ade80" : "#f87171" }}>{pwMsg.t}</p>}
          <Btn onClick={changePw} disabled={changing}>{changing ? "..." : "Change"}</Btn>
        </div>
      </Card>
    </div>
  );
}

function UpdateTab() {
  const [version, setVersion] = useState<any>(null);
  const [check, setCheck] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<any>(null);

  useEffect(() => { api.getVersion().then(setVersion); }, []);

  const checkForUpdates = async () => {
    setChecking(true);
    setCheck(null);
    try { setCheck(await api.checkUpdate()); }
    catch (e: any) { setCheck({ error: e.message }); }
    finally { setChecking(false); }
  };

  const applyUpdate = async () => {
    if (!confirm("This will update ZEUS and restart the service. Continue?")) return;
    setUpdating(true);
    try {
      const r = await api.applyUpdate();
      setUpdateResult(r);
      if (r.success) {
        setTimeout(() => window.location.reload(), 5000);
      }
    } catch (e: any) { setUpdateResult({ success: false, error: e.message }); }
    finally { setUpdating(false); }
  };

  return (
    <div className="max-w-xl space-y-4">
      {/* Current version */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Current version</h3>
          <span className="text-sm font-mono" style={{ color: "var(--accent)" }}>v{version?.current || "..."}</span>
        </div>
        <Btn onClick={checkForUpdates} disabled={checking}>{checking ? "Checking..." : "Check for updates"}</Btn>

        {check && !check.error && (
          <div className="mt-3 rounded-lg p-3 border" style={{ borderColor: check.upToDate ? "var(--border)" : "var(--accent)", background: check.upToDate ? "var(--bg-input)" : "var(--accent-bg)" }}>
            {check.upToDate ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>You're on the latest version.</p>
            ) : (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--accent)" }}>
                  Update available ({check.commitsAhead} change{check.commitsAhead > 1 ? "s" : ""})
                </p>
                <Btn variant="primary" onClick={applyUpdate} disabled={updating}>
                  {updating ? "Updating... (this may take a minute)" : "Install update"}
                </Btn>
              </div>
            )}
          </div>
        )}

        {check?.error && <p className="text-xs mt-2" style={{ color: "#f87171" }}>{check.error}</p>}

        {updateResult && (
          <div className="mt-3 rounded-lg p-3" style={{ background: updateResult.success ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}>
            <p className="text-xs" style={{ color: updateResult.success ? "#4ade80" : "#f87171" }}>
              {updateResult.success ? `${updateResult.message} Page will reload in 5 seconds.` : updateResult.error}
            </p>
          </div>
        )}
      </Card>

      {/* Changelog */}
      {version?.changelog && (
        <Card>
          <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>What's new</h3>
          <div className="space-y-4">
            {(check?.remoteChangelog?.length > 0 ? check.remoteChangelog : version.changelog).map((entry: any) => (
              <div key={entry.version}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-mono font-medium" style={{ color: "var(--accent)" }}>v{entry.version}</span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{entry.date}</span>
                </div>
                {entry.title && <p className="text-xs font-medium mb-1" style={{ color: "var(--text-primary)" }}>{entry.title}</p>}
                <ul className="space-y-0.5">
                  {entry.changes.map((c: string, i: number) => (
                    <li key={i} className="text-xs flex gap-1.5" style={{ color: "var(--text-muted)" }}>
                      <span style={{ color: "var(--text-secondary)" }}>·</span> {c}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
