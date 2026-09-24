import { create } from "zustand";

// Replaces the native window.confirm() used throughout the app (which renders as a plain
// browser/OS dialog, not styled at all) with an app-styled equivalent. window.confirm() is
// synchronous; this is a Promise-based drop-in (`await confirm(...)`) backed by a store so the
// single <ConfirmDialog/> mounted once in AuthGate's shell (same pattern as report-modal-store)
// can render whatever the last caller asked for.
interface ConfirmRequest {
  message: string;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
}

interface ConfirmStore {
  request: ConfirmRequest | null;
  resolve: ((result: boolean) => void) | null;
  settle: (result: boolean) => void;
}

export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  request: null,
  resolve: null,
  settle: (result) => {
    get().resolve?.(result);
    set({ request: null, resolve: null });
  },
}));

export function confirm(
  message: string,
  opts?: { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.setState({
      request: {
        message,
        title: opts?.title ?? "Please confirm",
        confirmLabel: opts?.confirmLabel ?? "Confirm",
        cancelLabel: opts?.cancelLabel ?? "Cancel",
        danger: opts?.danger ?? false,
      },
      resolve,
    });
  });
}
