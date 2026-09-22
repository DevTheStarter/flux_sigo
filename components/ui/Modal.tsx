"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** título simples; para cabeçalhos com subtítulo usar `header` */
  title?: string;
  subtitle?: React.ReactNode;
  header?: React.ReactNode;
  lg?: boolean;
  /** rótulo acessível quando não há título */
  label?: string;
}

/**
 * Modal do protótipo: desktop centrado (450px / 530px), mobile em ecrã inteiro
 * com cabeçalho fixo e ×. Bloqueia o scroll e esconde a navegação inferior
 * através de `body.locked` (spec §18.3).
 */
export function Modal({ open, onClose, children, title, subtitle, header, lg, label }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.body.classList.add("locked");
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("locked");
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="ovl"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={"modal" + (lg ? " lg" : "")} role="dialog" aria-modal="true" aria-label={title ?? label ?? "Janela"}>
        {(title || header) && (
          <div className="m-h">
            {header ?? (
              <div>
                <div className="m-t">{title}</div>
                {subtitle ? <div className="m-s">{subtitle}</div> : null}
              </div>
            )}
            <button className="m-x" aria-label="Fechar" onClick={onClose} type="button">
              ×
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}

export default Modal;
