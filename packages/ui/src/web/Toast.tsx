"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cx } from "../cx";
import { Icon } from "./Icon";

export type ToastVariant = "default" | "success" | "danger" | "info";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, string> = {
  default: "border-border-subtle",
  success: "border-success-500/40",
  danger: "border-danger-500/40",
  info: "border-info-500/40",
};

const variantIconColor: Record<ToastVariant, string> = {
  default: "text-content-muted",
  success: "text-success-500",
  danger: "text-danger-500",
  info: "text-info-500",
};

let toastIdCounter = 0;

export function ToastProvider({ children }: { children?: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      toastIdCounter += 1;
      const id = `toast-${toastIdCounter}`;
      const duration = options.duration ?? 4000;
      setToasts((current) => [...current, { ...options, id }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cx(
              "pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface-raised p-4 shadow-lg",
              variantStyles[item.variant ?? "default"],
            )}
          >
            <span className={cx("mt-0.5 inline-flex shrink-0", variantIconColor[item.variant ?? "default"])}>
              <Icon
                name={
                  item.variant === "success"
                    ? "check"
                    : item.variant === "danger"
                      ? "x"
                      : "bell"
                }
                size={16}
              />
            </span>
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold text-content-primary">
                {item.title}
              </span>
              {item.description && (
                <span className="text-sm text-content-muted">{item.description}</span>
              )}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => dismiss(item.id)}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-content-muted outline-none transition-colors duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)] hover:bg-surface-overlay hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
