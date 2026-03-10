const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    if (err.error === "not_authenticated") window.dispatchEvent(new CustomEvent("zeus:logout"));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export const api = {
  authStatus: () => request<any>("/auth/status"),
  onboard: (password: string, vmAddress: string, userName?: string, assistantName?: string, assistantPersonality?: string, city?: string, timezone?: string) =>
    request<any>("/auth/onboard", { method: "POST", body: JSON.stringify({ password, vmAddress, userName, assistantName, assistantPersonality, city, timezone }) }),
  login: (password: string) => request<any>("/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<any>("/auth/logout", { method: "POST" }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<any>("/auth/password", { method: "PUT", body: JSON.stringify({ currentPassword, newPassword }) }),
  updateVmAddress: (vmAddress: string) => request<any>("/auth/vm-address", { method: "PUT", body: JSON.stringify({ vmAddress }) }),

  dashboard: () => request<any>("/dashboard"),
  getSettings: () => request<Record<string, string>>("/settings"),
  updateSettings: (data: Record<string, string>) => request<any>("/settings", { method: "PUT", body: JSON.stringify(data) }),
  testConnection: (model?: string) =>
    request<any>("/settings/test", { method: "POST", body: JSON.stringify(model ? { model } : {}) }),

  getAgents: () => request<any[]>("/agents"),
  getAgent: (id: string) => request<any>(`/agents/${id}`),
  createAgent: (data: any) => request<any>("/agents", { method: "POST", body: JSON.stringify(data) }),
  updateAgent: (id: string, data: any) => request<any>(`/agents/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAgent: (id: string) => request<any>(`/agents/${id}`, { method: "DELETE" }),

  assignSkill: (agentId: string, skillId: string) => request<any>(`/agents/${agentId}/skills`, { method: "POST", body: JSON.stringify({ skillId }) }),
  removeSkill: (agentId: string, skillId: string) => request<any>(`/agents/${agentId}/skills/${skillId}`, { method: "DELETE" }),

  getConversations: (agentId: string) => request<any[]>(`/agents/${agentId}/conversations`),
  createConversation: (agentId: string, title?: string) => request<any>(`/agents/${agentId}/conversations`, { method: "POST", body: JSON.stringify({ title }) }),
  getMessages: (conversationId: string) => request<any[]>(`/conversations/${conversationId}/messages`),
  chat: (agentId: string, conversationId: string, message: string) =>
    request<any>(`/agents/${agentId}/chat`, { method: "POST", body: JSON.stringify({ conversationId, message }) }),

  getMemory: (agentId: string) => request<any[]>(`/agents/${agentId}/memory`),
  addMemory: (agentId: string, data: any) => request<any>(`/agents/${agentId}/memory`, { method: "POST", body: JSON.stringify(data) }),

  getTickets: (params?: Record<string, string>) => { const qs = params ? "?" + new URLSearchParams(params).toString() : ""; return request<any[]>(`/tickets${qs}`); },
  createTicket: (data: any) => request<any>("/tickets", { method: "POST", body: JSON.stringify(data) }),
  updateTicket: (id: string, data: any) => request<any>(`/tickets/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTicket: (id: string) => request<any>(`/tickets/${id}`, { method: "DELETE" }),
  processTicket: () => request<any>("/tickets/process", { method: "POST" }),

  getSkills: () => request<any[]>("/skills"),
  createSkill: (data: any) => request<any>("/skills", { method: "POST", body: JSON.stringify(data) }),
  updateSkill: (id: string, data: any) => request<any>(`/skills/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSkill: (id: string) => request<any>(`/skills/${id}`, { method: "DELETE" }),

  getSkillGaps: () => request<any[]>("/skill-gaps"),
  generateStub: (id: string) => request<any>(`/skill-gaps/${id}/generate`, { method: "POST" }),

  getLogs: (params?: Record<string, string>) => { const qs = params ? "?" + new URLSearchParams(params).toString() : ""; return request<any[]>(`/logs${qs}`); },
  clearLogs: () => request<any>("/logs", { method: "DELETE" }),

  telegramStatus: () => request<any>("/telegram/status"),
  telegramStart: () => request<any>("/telegram/start", { method: "POST" }),
  telegramStop: () => request<any>("/telegram/stop", { method: "POST" }),
  telegramPair: (agentId: string) => request<any>(`/telegram/pair/${agentId}`, { method: "POST" }),
  telegramPairings: () => request<any[]>("/telegram/pairings"),
  telegramUnpair: (id: string) => request<any>(`/telegram/pairings/${id}`, { method: "DELETE" }),

  getCharacters: (params?: { style?: string }) => {
    const qs = params?.style ? `?style=${encodeURIComponent(params.style)}` : "";
    return request<{ characters: any[] }>(`/characters${qs}`);
  },
  getCharacter: (id: string) => request<{ character: any }>(`/characters/${id}`),
  createCharacter: (data: { name: string; style?: string; appearance?: string; attitude?: string; role?: string; notes?: string }, imageFile?: File) => {
    if (imageFile) {
      const fd = new FormData();
      fd.append("name", data.name);
      fd.append("style", data.style || "hyper_realistic");
      fd.append("appearance", data.appearance || "");
      fd.append("attitude", data.attitude || "");
      fd.append("role", data.role || "");
      fd.append("notes", data.notes || "");
      fd.append("image", imageFile);
      return fetch("/api/characters", { method: "POST", credentials: "include", body: fd }).then((r) => { if (!r.ok) return r.json().then((e) => { throw new Error(e.error || "Failed"); }); return r.json(); });
    }
    return request<{ character: any }>("/characters", { method: "POST", body: JSON.stringify(data) });
  },
  describeCharacterFromImage: (imageFile: File, style: string) => {
    const fd = new FormData();
    fd.append("image", imageFile);
    fd.append("style", style);
    return fetch("/api/characters/describe-from-image", { method: "POST", credentials: "include", body: fd }).then((r) => { if (!r.ok) return r.json().then((e) => { throw new Error(e.error || "Failed"); }); return r.json(); });
  },
  updateCharacter: (id: string, data: Partial<{ name: string; style: string; appearance: string; attitude: string; role: string; notes: string }>) =>
    request<{ character: any }>(`/characters/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  createOutfit: (characterId: string, data: { name: string; description?: string }) =>
    request<{ outfit: any }>(`/characters/${characterId}/outfits`, { method: "POST", body: JSON.stringify(data) }),
  updateOutfit: (characterId: string, outfitId: string, data: { name?: string; description?: string }) =>
    request<{ outfit: any }>(`/characters/${characterId}/outfits/${outfitId}`, { method: "PUT", body: JSON.stringify(data) }),

  getAutomations: () => request<any[]>("/automations"),
  createAutomation: (data: any) => request<any>("/automations", { method: "POST", body: JSON.stringify(data) }),
  testAutomation: (id: string) => request<any>(`/automations/${id}/test`, { method: "POST" }),
  confirmAutomation: (id: string) => request<any>(`/automations/${id}/confirm`, { method: "POST" }),
  deleteAutomation: (id: string) => request<any>(`/automations/${id}`, { method: "DELETE" }),
  getScheduledTasks: () => request<any[]>("/scheduled-tasks"),
  updateScheduledTask: (id: string, data: any) => request<any>(`/scheduled-tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  getEmails: (params?: Record<string, string>) => { const qs = params ? "?" + new URLSearchParams(params).toString() : ""; return request<any[]>(`/emails${qs}`); },
  getEmail: (id: string) => request<any>(`/emails/${id}`),
  deleteEmail: (id: string) => request<any>(`/emails/${id}`, { method: "DELETE" }),
  syncEmails: () => request<any>("/emails/sync", { method: "POST" }),
  sendNewEmail: (to: string, subject: string, body: string) => request<any>("/emails/send", { method: "POST", body: JSON.stringify({ to, subject, body }) }),
  testImap: () => request<any>("/emails/test-imap", { method: "POST" }),
  testSmtp: () => request<any>("/emails/test-smtp", { method: "POST" }),

  getModules: () => request<any[]>("/modules"),
  installModule: (slug: string) => request<any>(`/modules/${slug}/install`, { method: "POST" }),
  uninstallModule: (slug: string) => request<any>(`/modules/${slug}/uninstall`, { method: "POST" }),
  updateModuleConfig: (slug: string, config: Record<string, string>) =>
    request<any>(`/modules/${slug}/config`, { method: "PUT", body: JSON.stringify(config) }),
  activateModule: (slug: string) => request<any>(`/modules/${slug}/activate`, { method: "POST" }),

  // Reminders
  getReminders: () => request<any[]>("/reminders"),
  createReminder: (data: any) => request<any>("/reminders", { method: "POST", body: JSON.stringify(data) }),
  deleteReminder: (id: string) => request<any>(`/reminders/${id}`, { method: "DELETE" }),

  // Notifications
  getNotifications: (unread?: boolean) => request<any[]>(`/notifications${unread ? "?unread=true" : ""}`),
  notifCount: () => request<any>("/notifications/count"),
  readNotif: (id: string) => request<any>(`/notifications/${id}/read`, { method: "POST" }),
  readAllNotifs: () => request<any>("/notifications/read-all", { method: "POST" }),

  // Calendar
  getEvents: (start?: string, end?: string) => {
    const p = new URLSearchParams();
    if (start) p.set("start", start);
    if (end) p.set("end", end);
    const qs = p.toString();
    return request<any[]>(`/calendar${qs ? "?" + qs : ""}`);
  },
  createEvent: (data: any) => request<any>("/calendar", { method: "POST", body: JSON.stringify(data) }),
  updateEvent: (id: string, data: any) => request<any>(`/calendar/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteEvent: (id: string) => request<any>(`/calendar/${id}`, { method: "DELETE" }),

  // Notes
  getNotes: () => request<any[]>("/notes"),
  createNote: (data: any) => request<any>("/notes", { method: "POST", body: JSON.stringify(data) }),
  updateNote: (id: string, data: any) => request<any>(`/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteNote: (id: string) => request<any>(`/notes/${id}`, { method: "DELETE" }),

  // Search
  search: (q: string) => request<any>(`/search?q=${encodeURIComponent(q)}`),

  // Usage / Cost
  getUsage: (period?: string) => request<any>(`/usage${period ? "?period=" + period : ""}`),
  setUsageLimit: (limit: number) => request<any>("/usage/limit", { method: "PUT", body: JSON.stringify({ limit }) }),

  // Export / Backup
  createBackup: () => request<any>("/backup", { method: "POST" }),
  getBackups: () => request<any>("/backups"),
  restoreBackup: (name: string) => request<any>(`/backup/restore/${name}`, { method: "POST" }),

  // Weather
  getWeather: () => request<any>("/weather"),

  // Updates
  getVersion: () => request<any>("/version"),
  checkUpdate: () => request<any>("/version/check", { method: "POST" }),
  applyUpdate: () => request<any>("/version/update", { method: "POST" }),
};
