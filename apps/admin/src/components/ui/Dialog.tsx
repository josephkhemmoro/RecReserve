"use client";

import { createContext, useCallback, useContext, useState, useEffect } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X, AlertTriangle, Trash2, Info } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/cn";

// ============================================================================
// Generic Dialog wrapper around Radix
// ============================================================================

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  showClose?: boolean;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

export function Dialog({ open, onOpenChange, title, description, children, footer, size = "md", showClose = true }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px]" />
        <RadixDialog.Content
          className={cn(
            "dialog-content fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)]",
            "-translate-x-1/2 -translate-y-1/2",
            "bg-white rounded-xl shadow-2xl border border-slate-200/80",
            "p-6 focus:outline-none",
            sizeClasses[size]
          )}
        >
          <div className="flex items-start justify-between gap-4 mb-1">
            <div className="min-w-0 flex-1">
              <RadixDialog.Title className="text-lg font-bold text-slate-900 leading-tight">
                {title}
              </RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            {showClose && (
              <RadixDialog.Close asChild>
                <button
                  className="flex-shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </RadixDialog.Close>
            )}
          </div>
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

// ============================================================================
// Confirm Dialog — replaces window.confirm()
// ============================================================================

type ConfirmTone = "default" | "danger" | "warning";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

const toneIcons = {
  default: { Icon: Info, bg: "bg-blue-50", color: "text-blue-600" },
  warning: { Icon: AlertTriangle, bg: "bg-amber-50", color: "text-amber-600" },
  danger: { Icon: Trash2, bg: "bg-red-50", color: "text-red-600" },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const { Icon, bg, color } = toneIcons[tone];

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description} size="sm" showClose={false}>
      <div className="flex items-start gap-4 -mt-4">
        <div className={cn("flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center mt-1", bg)}>
          <Icon className={cn("h-5 w-5", color)} />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

// ============================================================================
// Prompt Dialog — replaces window.prompt()
// ============================================================================

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  defaultValue?: string;
  required?: boolean;
  multiline?: boolean;
  tone?: ConfirmTone;
  onSubmit: (value: string) => void | Promise<void>;
  loading?: boolean;
  /** If set, the user must type this exact phrase to enable confirm. Useful for destructive actions. */
  requireTypedConfirmation?: string;
}

export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  defaultValue = "",
  required = false,
  multiline = false,
  tone = "default",
  onSubmit,
  loading = false,
  requireTypedConfirmation,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  const canSubmit = !loading
    && (!required || value.trim().length > 0)
    && (!requireTypedConfirmation || value.trim() === requireTypedConfirmation);

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description} size="md" showClose={!loading}>
      {requireTypedConfirmation && (
        <p className="text-xs text-slate-500 mb-2">
          Type <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">{requireTypedConfirmation}</code> to confirm:
        </p>
      )}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          rows={3}
          autoFocus
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) handleSubmit(); }}
          placeholder={placeholder}
          autoFocus
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
        />
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

// ============================================================================
// useConfirm / usePrompt — promise-based hooks for procedural code
// ============================================================================

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface PromptOptions extends ConfirmOptions {
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  multiline?: boolean;
  requireTypedConfirmation?: string;
}

interface DialogContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [promptState, setPromptState] = useState<(PromptOptions & { resolve: (v: string | null) => void }) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...opts, resolve });
    });
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPromptState({ ...opts, resolve });
    });
  }, []);

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {confirmState && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) { confirmState.resolve(false); setConfirmState(null); } }}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          tone={confirmState.tone}
          onConfirm={() => { confirmState.resolve(true); setConfirmState(null); }}
        />
      )}
      {promptState && (
        <PromptDialog
          open
          onOpenChange={(o) => { if (!o) { promptState.resolve(null); setPromptState(null); } }}
          title={promptState.title}
          description={promptState.description}
          confirmLabel={promptState.confirmLabel}
          cancelLabel={promptState.cancelLabel}
          tone={promptState.tone}
          placeholder={promptState.placeholder}
          defaultValue={promptState.defaultValue}
          required={promptState.required}
          multiline={promptState.multiline}
          requireTypedConfirmation={promptState.requireTypedConfirmation}
          onSubmit={(value) => { promptState.resolve(value); setPromptState(null); }}
        />
      )}
    </DialogContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useConfirm must be used inside <DialogProvider>");
  return ctx.confirm;
}

export function usePrompt() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("usePrompt must be used inside <DialogProvider>");
  return ctx.prompt;
}
