"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
  /** impede fechar por backdrop/ESC, a menos que actions sejam perigosas (delete confirm). */
  blocking?: boolean;
  widthPx?: number;
}

export function Modal({
  open,
  onClose,
  children,
  title,
  actions,
  blocking,
  widthPx = 520,
}: ModalProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !blocking) onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, blocking]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "modal"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        aria-hidden
        onClick={() => {
          if (!blocking) onClose();
        }}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15, 15, 15, 0.55)",
        }}
      />
      <div
        ref={ref}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: widthPx,
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          boxShadow: "var(--shadow-dropdown)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100vh - 64px)",
          overflow: "hidden",
        }}
      >
        {(title || !blocking) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {title}
            </h3>
            {!blocking && (
              <button
                aria-label="Fechar"
                onClick={onClose}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--muted)",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "inherit",
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>
        )}
        <div style={{ padding: 16, overflow: "auto" }}>{children}</div>
        {actions && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              padding: "12px 16px",
              borderTop: "1px solid var(--border)",
            }}
          >
            {actions}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default Modal;
