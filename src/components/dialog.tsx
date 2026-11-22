"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEventHandler, type ReactNode } from "react";

export function Dialog({ title, children, onClose, variant = "panel", dismiss = false, onKeyDown }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  variant?: "panel" | "sheet" | "fullscreen" | "date-range";
  dismiss?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLDialogElement>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [closing, setClosing] = useState(false);
  const onDismiss = useRef(onClose);
  useEffect(() => { onDismiss.current = onClose; }, [onClose]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => { if (dismiss) setClosing(true); }, [dismiss]);
  useEffect(() => {
    if (!closing) return;
    const time = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 250;
    const timer = window.setTimeout(() => onDismiss.current(), time);
    return () => window.clearTimeout(timer);
  }, [closing]);
  return (
    <dialog ref={ref} className={"dialog overlay-" + variant} aria-labelledby={titleId} data-closing={closing}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
          setClosing(true);
        }
      }}
      onCancel={(event) => { event.preventDefault(); setClosing(true); }}>
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" type="button" aria-label="Закрыть" onClick={() => setClosing(true)}><X size={21} aria-hidden="true" /></button>
      </div>
      {children}
    </dialog>
  );
}
