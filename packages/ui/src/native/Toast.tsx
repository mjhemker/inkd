import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pressable, Text, View } from "react-native";
import { cx } from "../cx";
import { Icon } from "./Icon";

export type ToastVariant = "default" | "success" | "danger" | "info";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastEntry extends Required<Pick<ToastOptions, "title" | "variant" | "duration">> {
  id: number;
  description?: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantClass: Record<ToastVariant, string> = {
  default: "border-border-subtle bg-surface-overlay",
  success: "border-success-700 bg-surface-overlay",
  danger: "border-danger-700 bg-surface-overlay",
  info: "border-info-700 bg-surface-overlay",
};

const variantIcon: Record<ToastVariant, "check" | "x" | "bell"> = {
  default: "bell",
  success: "check",
  danger: "x",
  info: "bell",
};

export interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      const duration = options.duration ?? 4000;
      const entry: ToastEntry = {
        id,
        title: options.title,
        description: options.description,
        variant: options.variant ?? "default",
        duration,
      };
      setToasts((current) => [...current, entry]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        className="absolute inset-x-0 top-14 items-center gap-2 px-4"
      >
        {toasts.map((entry) => (
          <Pressable
            key={entry.id}
            accessibilityRole="alert"
            onPress={() => dismiss(entry.id)}
            className={cx(
              "w-full max-w-md flex-row items-start gap-2 rounded-xl border p-3",
              variantClass[entry.variant],
            )}
          >
            <Icon name={variantIcon[entry.variant]} size={16} color="#A1A1AA" />
            <View className="flex-1 gap-0.5">
              <Text className="font-sans-semibold text-sm text-content-primary">
                {entry.title}
              </Text>
              {entry.description ? (
                <Text className="text-sm text-content-muted">
                  {entry.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
