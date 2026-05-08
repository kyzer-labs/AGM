"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DialogShell,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/dialog/dialog";

type Variant = "default" | "destructive";

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: Variant;
}

export interface PromptOptions {
  title: string;
  description?: React.ReactNode;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  multiline?: boolean;
  validate?: (value: string) => string | null;
  confirmText?: string;
  cancelText?: string;
  variant?: Variant;
}

export interface DialogApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

interface ConfirmRequest {
  type: "confirm";
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

interface PromptRequest {
  type: "prompt";
  options: PromptOptions;
  resolve: (value: string | null) => void;
}

type Request = ConfirmRequest | PromptRequest;

const DialogContext = React.createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const ctx = React.useContext(DialogContext);
  if (!ctx) {
    throw new Error("useDialog must be used within <DialogProvider>");
  }
  return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = React.useState<Request | null>(null);

  const api = React.useMemo<DialogApi>(
    () => ({
      confirm(options) {
        return new Promise<boolean>((resolve) => {
          setRequest({ type: "confirm", options, resolve });
        });
      },
      prompt(options) {
        return new Promise<string | null>((resolve) => {
          setRequest({ type: "prompt", options, resolve });
        });
      },
    }),
    [],
  );

  const close = React.useCallback(
    (value: boolean | string | null) => {
      const current = request;
      if (!current) return;
      if (current.type === "confirm") {
        current.resolve(typeof value === "boolean" ? value : false);
      } else {
        current.resolve(typeof value === "string" ? value : null);
      }
      setRequest(null);
    },
    [request],
  );

  return (
    <DialogContext.Provider value={api}>
      {children}
      {request?.type === "confirm" ? (
        <ConfirmDialog request={request} onResolve={(v) => close(v)} />
      ) : null}
      {request?.type === "prompt" ? (
        <PromptDialog request={request} onResolve={(v) => close(v)} />
      ) : null}
    </DialogContext.Provider>
  );
}

const titleId = "dialog-title";
const descriptionId = "dialog-description";

function ConfirmDialog({
  request,
  onResolve,
}: {
  request: ConfirmRequest;
  onResolve: (value: boolean) => void;
}) {
  const confirmRef = React.useRef<HTMLButtonElement>(null);
  const { options } = request;
  const variant = options.variant ?? "default";

  return (
    <DialogShell
      open
      onClose={() => onResolve(false)}
      labelledBy={titleId}
      describedBy={options.description ? descriptionId : undefined}
      initialFocusRef={confirmRef}
    >
      <DialogHeader>
        <DialogTitle id={titleId}>{options.title}</DialogTitle>
        {options.description ? (
          <DialogDescription id={descriptionId}>{options.description}</DialogDescription>
        ) : null}
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => onResolve(false)}>
          {options.cancelText ?? "Cancel"}
        </Button>
        <Button
          ref={confirmRef}
          variant={variant === "destructive" ? "destructive" : "primary"}
          onClick={() => onResolve(true)}
        >
          {options.confirmText ?? "Confirm"}
        </Button>
      </DialogFooter>
    </DialogShell>
  );
}

function PromptDialog({
  request,
  onResolve,
}: {
  request: PromptRequest;
  onResolve: (value: string | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const initialFocusRef = React.useRef<HTMLElement>(null);
  const [value, setValue] = React.useState<string>(request.options.defaultValue ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const { options } = request;
  const variant = options.variant ?? "default";

  React.useEffect(() => {
    setValue(options.defaultValue ?? "");
    setError(null);
    const target = inputRef.current;
    if (target instanceof HTMLElement) {
      initialFocusRef.current = target;
      target.focus();
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        target.select?.();
      }
    }
  }, [options.defaultValue]);

  function submit() {
    const trimmed = value.trim();
    if (options.required && trimmed.length === 0) {
      setError("This field is required");
      return;
    }
    if (options.validate) {
      const validationError = options.validate(value);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    onResolve(value);
  }

  function onKey(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" && !options.multiline) {
      event.preventDefault();
      submit();
    }
    if (event.key === "Enter" && options.multiline && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <DialogShell
      open
      onClose={() => onResolve(null)}
      labelledBy={titleId}
      describedBy={options.description ? descriptionId : undefined}
      initialFocusRef={initialFocusRef}
    >
      <DialogHeader>
        <DialogTitle id={titleId}>{options.title}</DialogTitle>
        {options.description ? (
          <DialogDescription id={descriptionId}>{options.description}</DialogDescription>
        ) : null}
      </DialogHeader>
      <DialogBody>
        <div className="flex flex-col gap-2">
          {options.label ? <Label htmlFor="dialog-prompt-input">{options.label}</Label> : null}
          {options.multiline ? (
            <Textarea
              id="dialog-prompt-input"
              ref={(el) => {
                inputRef.current = el;
              }}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError(null);
              }}
              onKeyDown={onKey}
              placeholder={options.placeholder}
              rows={4}
            />
          ) : (
            <Input
              id="dialog-prompt-input"
              ref={(el) => {
                inputRef.current = el;
              }}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError(null);
              }}
              onKeyDown={onKey}
              placeholder={options.placeholder}
            />
          )}
          {error ? (
            <p className="text-sm text-[var(--color-destructive)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={() => onResolve(null)}>
          {options.cancelText ?? "Cancel"}
        </Button>
        <Button
          variant={variant === "destructive" ? "destructive" : "primary"}
          onClick={submit}
        >
          {options.confirmText ?? "OK"}
        </Button>
      </DialogFooter>
    </DialogShell>
  );
}
