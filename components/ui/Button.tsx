import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANT: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "var(--fg)",
    color: "var(--bg)",
    border: "1px solid var(--fg)",
  },
  secondary: {
    background: "var(--panel)",
    color: "var(--fg)",
    border: "1px solid var(--border)",
  },
  ghost: {
    background: "transparent",
    color: "var(--fg)",
    border: "1px solid transparent",
  },
  danger: {
    background: "var(--red)",
    color: "white",
    border: "1px solid var(--red)",
  },
};

const SIZE: Record<Size, React.CSSProperties> = {
  sm: { height: 32, padding: "0 12px", fontSize: 13, borderRadius: 6 },
  md: { height: 40, padding: "0 14px", fontSize: 14, borderRadius: 6 },
  lg: { height: 44, padding: "0 18px", fontSize: 14, borderRadius: 6 },
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  disabled,
  style,
  children,
  ...rest
}: ButtonProps) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontWeight: 600,
    lineHeight: 1,
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.55 : 1,
    transition: "background 120ms ease, opacity 120ms ease",
    userSelect: "none",
    whiteSpace: "nowrap",
    fontFamily: "inherit",
  };
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      style={{ ...base, ...VARIANT[variant], ...SIZE[size], ...style }}
    >
      {loading && (
        <span aria-hidden style={{ fontVariantNumeric: "tabular-nums" }}>
          …
        </span>
      )}
      {children}
    </button>
  );
}

export default Button;
