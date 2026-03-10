import { ReactNode } from "react";

export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-lg border p-5 ${className}`}
      style={{ background: "var(--bg-card)", borderColor: "var(--border)", ...style }}>
      {children}
    </div>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xl font-semibold mb-5" style={{ color: "var(--text-primary)" }}>{children}</h2>;
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>{children}</label>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className={`w-full rounded-md border px-3 py-2 text-sm transition-colors ${props.className || ""}`}
      style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)", ...props.style }} />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props}
      className={`w-full rounded-md border px-3 py-2 text-sm transition-colors ${props.className || ""}`}
      style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)", ...props.style }} />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select {...props}
      className={`rounded-md border px-3 py-2 text-sm ${props.className || ""}`}
      style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)", ...props.style }}>
      {props.children}
    </select>
  );
}

export function Btn({ children, variant = "default", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "default" | "danger" | "ghost"; children: ReactNode }) {
  const base = "px-4 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-40";
  const variants = {
    primary: `${base} text-black hover:brightness-110`,
    default: `${base} hover:brightness-125`,
    danger: `${base} hover:brightness-125`,
    ghost: `${base} hover:brightness-150`,
  };
  const bgStyles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--accent)", color: "#fff" },
    default: { background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)", border: "1px solid var(--border)" },
    danger: { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" },
    ghost: { background: "transparent", color: "var(--text-secondary)" },
  };
  return <button {...props} className={variants[variant]} style={{ ...bgStyles[variant], ...props.style }}>{children}</button>;
}

export function Badge({ children, color = "gray" }: { children: ReactNode; color?: "green" | "red" | "amber" | "blue" | "purple" | "gray" }) {
  const colors = {
    green: { background: "rgba(34,197,94,0.12)", color: "#4ade80" },
    red: { background: "rgba(239,68,68,0.12)", color: "#f87171" },
    amber: { background: "rgba(245,158,11,0.12)", color: "#fbbf24" },
    blue: { background: "rgba(59,130,246,0.12)", color: "#60a5fa" },
    purple: { background: "rgba(168,85,247,0.12)", color: "#c084fc" },
    gray: { background: "rgba(156,163,175,0.12)", color: "#9ca3af" },
  };
  return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={colors[color]}>{children}</span>;
}

export function Divider() {
  return <div className="my-4" style={{ borderTop: "1px solid var(--border)" }} />;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>{children}</p>;
}
