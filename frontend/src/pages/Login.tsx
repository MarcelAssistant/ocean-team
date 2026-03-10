import { useState } from "react";
import { api } from "../api";

interface Props { onLogin: () => void; }

export default function Login({ onLogin }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      await api.login(password);
      onLogin();
    } catch (e: any) {
      setError(e.message === "not_authenticated" ? "Invalid password." : e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-root)" }}>
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="text-2xl font-semibold tracking-wide mb-1" style={{ color: "var(--accent)" }}>OCEAN</div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sign in to your agent workspace</p>
        </div>

        <div className="rounded-xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <div className="mb-4">
            <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Password</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Enter password"
              autoFocus
              className="w-full rounded-md border px-3 py-2.5 text-sm"
              style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          {error && <p className="text-xs mb-3" style={{ color: "#f87171" }}>{error}</p>}

          <button
            onClick={submit} disabled={loading || !password}
            className="w-full py-2.5 rounded-md text-sm font-medium disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {loading ? "..." : "Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}
