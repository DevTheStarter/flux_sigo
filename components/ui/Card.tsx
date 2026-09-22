import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section" | "article" | "aside";
  clickable?: boolean;
}

export function Card({
  as: Tag = "div",
  clickable,
  style,
  children,
  className,
  ...rest
}: CardProps) {
  const base: React.CSSProperties = {
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    cursor: clickable ? "pointer" : "default",
  };
  return (
    <Tag style={{ ...base, ...style }} {...rest} className={className}>
      {children}
    </Tag>
  );
}

export default Card;
