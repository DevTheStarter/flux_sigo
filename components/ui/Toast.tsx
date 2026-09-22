"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type ToastFn = (mensagem: string) => void;

const ToastCtx = createContext<ToastFn>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState("");
  const [visivel, setVisivel] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback<ToastFn>((m) => {
    setMsg(m);
    setVisivel(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisivel(false), 2200);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className={"toast" + (visivel ? " show" : "")} role="status" aria-live="polite">
        {msg}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastFn {
  return useContext(ToastCtx);
}
