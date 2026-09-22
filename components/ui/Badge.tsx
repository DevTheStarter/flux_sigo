import React from "react";

export type BadgeTone =
  | "success"
  | "missing_data"
  | "error"
  | "bloqueada"
  | "atrasada"
  | "hoje"
  | "ok"
  | "info"
  | "neutral";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** mostra o ponto colorido à esquerda sem caixa de fundo */
  dot?: boolean;
}

const TONES: Record<BadgeTone, React.CSSProperties> = {
  success: {
    background: "rgba(65, 158, 94, 0.14)",
    color: "#2a7a48",
    border: "1px solid rgba(65, 158, 94, 0.35)",
  },
  missing_data: {
    background: "rgba(234, 179, 8, 0.12)",
    color: "#8b6914",
    border: "1px solid rgba(234, 179, 8, 0.35)",
  },
  error: {
    background: "var(--red-pale)",
    color: "var(--red)",
    border: "1px solid rgba(180, 68, 60, 0.35)",
  },
  bloqueada: {
    background: "var(--red-pale)",
    color: "var(--red)",
    border: "1px solid rgba(180, 68, 60, 0.35)",
  },
  atrasada: {
    background: "var(--red-pale)",
    color: "var(--red)",
    border: "1px solid rgba(180, 68, 60, 0.35)",
  },
  hoje: {
    background: "rgba(59, 130, 246, 0.12)",
    color: "#1d4ed8",
    border: "1px solid rgba(59, 130, 246, 0.35)",
  },
  ok: {
    background: "transparent",
    color: "var(--muted)",
    border: "1px solid var(--border)",
  },
  info: {
    background: "rgba(59, 130, 246, 0.12)",
    color: "#1d4ed8",
    border: "1px solid rgba(59, 130, 246, 0.35)",
  },
  neutral: {
    background: "var(--panel)",
    color: "var(--fg)",
    border: "1px solid var(--border)",
  },
};

export function Badge({
  tone = "neutral",
  dot,
  style,
  children,
  ...rest
}: BadgeProps) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: dot ? "0 0" : "3px 8px",
    borderRadius: 999,
    fontSize: 12,
    lineHeight: 1.2,
    fontWeight: 500,
    whiteSpace: "nowrap",
  };
  if (dot) {
    const cor = TONES[tone].color;
    return (
      <span style={{ ...base, color: "var(--fg)", ...style }} {...rest}>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: cor,
            flexShrink: 0,
          }}
        />
        {children}
      </span>
    );
  }
  return (
    <span style={{ ...base, ...TONES[tone], ...style }} {...rest}>
      {children}
    </span>
  );
}

export default Badge;
