"use client";

import React, { createContext, useContext, useId, useMemo } from "react";

type Ctx = {
  value: string;
  onChange: (v: string) => void;
  baseId: string;
};

const TabsCtx = createContext<Ctx | null>(null);

export interface TabsProps {
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Tabs({ value, onValueChange, children, className, style }: TabsProps) {
  const baseId = useId();
  const ctx = useMemo<Ctx>(() => ({ value, onChange: onValueChange, baseId }), [
    value,
    onValueChange,
    baseId,
  ]);
  return (
    <TabsCtx.Provider value={ctx}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, ...style }} className={className}>
        {children}
      </div>
    </TabsCtx.Provider>
  );
}

export function TabsList({
  children,
  style,
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={className}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        padding: 2,
        borderBottom: "1px solid var(--border)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function Tab({ value, children, style, className, ...rest }: TabProps) {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error("Tab precisa de Tabs");
  const active = ctx.value === value;
  return (
    <button
      role="tab"
      aria-selected={active}
      id={`${ctx.baseId}-tab-${value}`}
      aria-controls={`${ctx.baseId}-panel-${value}`}
      {...rest}
      type="button"
      onClick={(e) => {
        ctx.onChange(value);
        rest.onClick?.(e);
      }}
      style={{
        position: "relative",
        border: "none",
        background: "transparent",
        padding: "8px 12px",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        color: active ? "var(--fg)" : "var(--muted)",
        cursor: "pointer",
        marginBottom: -1,
        fontFamily: "inherit",
        whiteSpace: "nowrap",
        ...(active
          ? { boxShadow: `inset 0 -2px 0 var(--fg)` }
          : {}),
        ...style,
      }}
      className={className}
    >
      {children}
    </button>
  );
}

export interface TabPanelProps {
  value: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function TabPanel({ value, children, style, className }: TabPanelProps) {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error("TabPanel precisa de Tabs");
  if (ctx.value !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${ctx.baseId}-panel-${value}`}
      aria-labelledby={`${ctx.baseId}-tab-${value}`}
      style={{ padding: 4, ...style }}
      className={className}
    >
      {children}
    </div>
  );
}

export default Tabs;
