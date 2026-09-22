import React from "react";

export interface PillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  tone?: "neutral" | "danger" | "ok";
  /** contador à direita no pill, com estilo perigo se > 0 para quick filters. */
  count?: number;
  size?: "sm" | "md";
  dot?: boolean;
}

export function Pill({
  active,
  tone = "neutral",
  count,
  size = "md",
  dot = false,
  children,
  style,
  className,
  ...rest
}: PillProps) {
  const perigo = tone === "danger" && typeof count === "number" && count > 0;
  const altura = size === "sm" ? 28 : 34;
  const padH = size === "sm" ? 10 : 14;
  const fsize = size === "sm" ? 12 : 13;
  const okColor = "#2f7d4b";
  const okBorder = "#2f7d4b";

  let fundo: React.CSSProperties;
  if (active) {
    if (perigo) {
      fundo = {
        background: "var(--red)",
        color: "white",
        border: "1px solid var(--red)",
      };
    } else if (tone === "ok") {
      fundo = {
        background: okColor,
        color: "white",
        border: `1px solid ${okBorder}`,
      };
    } else {
      fundo = {
        background: "var(--fg)",
        color: "var(--bg)",
        border: "1px solid var(--fg)",
      };
    }
  } else {
    fundo = {
      background: "var(--panel)",
      color: perigo ? "var(--red)" : tone === "ok" ? okColor : "var(--fg)",
      border: "1px solid " + (tone === "ok" ? okBorder : "var(--border)"),
    };
  }

  return (
    <button
      type="button"
      {...rest}
      className={className}
      style={{
        height: altura,
        padding: `0 ${padH}px 0 ${padH}px`,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: fsize,
        fontWeight: 500,
        lineHeight: 1,
        cursor: "pointer",
        fontFamily: "inherit",
        userSelect: "none",
        whiteSpace: "nowrap",
        ...fundo,
        ...style,
      }}
    >
      <span>{children}</span>
      {typeof count === "number" && (
        <span
          aria-hidden
          style={{
            minWidth: 18,
            padding: "2px 6px",
            borderRadius: 999,
            fontSize: size === "sm" ? 11 : 12,
            lineHeight: 1,
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "center",
            background: active ? "rgba(255,255,255,0.18)" : "var(--bg)",
            color: "inherit",
            border: active ? "none" : "1px solid var(--border)",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export default Pill;
