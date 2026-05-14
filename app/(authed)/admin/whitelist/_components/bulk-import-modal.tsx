"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  USM_DOMAIN,
  VOTER_CLASS_LABEL,
  VOTER_CLASS_OPTIONS,
  type BulkRow,
  type VoterClass,
} from "./whitelist-model";

export function BulkImportModal({
  open,
  defaultClass,
  importing,
  onChangeDefaultClass,
  onClose,
  onSubmitPaste,
  onSubmitCsv,
}: {
  open: boolean;
  defaultClass: VoterClass;
  importing: boolean;
  onChangeDefaultClass: (cls: VoterClass) => void;
  onClose: () => void;
  onSubmitPaste: (rows: BulkRow[]) => Promise<void> | void;
  onSubmitCsv: (rows: BulkRow[], fileName: string) => Promise<void> | void;
}) {
  const pasteId = useId();
  const defaultClassId = useId();
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [paste, setPaste] = useState("");

  useEffect(() => {
    if (!open) setPaste("");
  }, [open]);

  const onPasteSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const lines = paste.split(/\r?\n/);
    const rows: BulkRow[] = [];
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];
      if (!line || line.trim().length === 0) continue;
      const pieces = line
        .split(/[,;]\s*/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (pieces.length === 0) continue;
      pieces.forEach((email, j) => {
        rows.push({
          displayRow:
            pieces.length === 1
              ? `Line ${lineNum}`
              : `Line ${lineNum}, item ${j + 1}`,
          email,
        });
      });
    }
    if (rows.length === 0) {
      toast.error("Nothing to import", {
        description: "Paste at least one email address.",
      });
      return;
    }
    void onSubmitPaste(rows);
  };

  const tryHeaderlessParse = (file: File): Promise<BulkRow[] | null> => {
    return new Promise((resolve) => {
      Papa.parse<string[]>(file, {
        complete: (r) => {
          const rows: BulkRow[] = [];
          for (let i = 0; i < r.data.length; i++) {
            const cells = r.data[i];
            if (!Array.isArray(cells)) continue;
            for (let j = 0; j < cells.length; j++) {
              const cell = cells[j];
              if (typeof cell !== "string") continue;
              const trimmed = cell.trim();
              if (trimmed.length === 0) continue;
              rows.push({
                displayRow:
                  cells.length > 1
                    ? `Row ${i + 1}, col ${j + 1}`
                    : `Row ${i + 1}`,
                email: trimmed,
              });
            }
          }
          resolve(rows.length > 0 ? rows : null);
        },
        error: () => resolve(null),
      });
    });
  };

  const onCsvUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: async (result) => {
        const fatalParseErrors = result.errors.filter(
          (err) => err.code !== "TooFewFields",
        );
        if (fatalParseErrors.length > 0) {
          const first = fatalParseErrors[0];
          const rowLabel =
            typeof first?.row === "number"
              ? `Row ${first.row + 2}`
              : "CSV";
          toast.error("Could not parse CSV", {
            description: `${rowLabel}: ${first?.message ?? "Unknown parse error"}`,
          });
          return;
        }

        const detected = (result.meta.fields ?? []).map((c) => c.trim());
        const detectedLc = new Set(
          detected.map((c) => c.toLowerCase()),
        );
        const hasEmailColumn =
          detectedLc.has("email") ||
          detectedLc.has("e-mail") ||
          detectedLc.has("mail") ||
          detectedLc.has("student email");

        if (!hasEmailColumn) {
          const fallback = await tryHeaderlessParse(file);
          if (!fallback) {
            toast.error("CSV missing required column", {
              description: `Add an "email" column. Detected: ${
                detected.length > 0 ? detected.join(", ") : "(none)"
              }.`,
            });
            return;
          }
          await onSubmitCsv(fallback, file.name);
          return;
        }

        const rows: BulkRow[] = [];
        for (let i = 0; i < result.data.length; i++) {
          const row = result.data[i] ?? {};
          const email = (
            row.email ??
            row.Email ??
            row["E-mail"] ??
            row["e-mail"] ??
            row.mail ??
            row["Student Email"] ??
            ""
          ).trim();
          if (email.length === 0) continue;
          const cls = (
            row.voterClass ??
            row.VoterClass ??
            row.class ??
            row.Class ??
            row.role ??
            row.Role ??
            ""
          ).trim();
          rows.push({
            displayRow: `Row ${i + 2}`,
            email,
            voterClass: cls.length > 0 ? cls : undefined,
          });
        }
        if (rows.length === 0) {
          toast.error("No usable rows", {
            description:
              "Every row was missing an email value. Add the email to each row and re-upload.",
          });
          return;
        }
        await onSubmitCsv(rows, file.name);
      },
      error: (err) => {
        toast.error("CSV parse failed", { description: err.message });
      },
    });
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!importing) onClose();
      }}
      title="Bulk import evaluators"
      description={
        <>
          Paste comma, semicolon, or newline-separated emails, or upload a
          CSV with <code>email</code> and optional <code>voterClass</code>{" "}
          columns. Rows without a class fall back to the default below.
          Every email must end in <code>{USM_DOMAIN}</code>.
        </>
      }
    >
      <form onSubmit={onPasteSubmit} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor={pasteId}>Emails</Label>
          <Textarea
            id={pasteId}
            rows={6}
            placeholder={`alice${USM_DOMAIN}\nbob${USM_DOMAIN}`}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            aria-describedby={`${pasteId}-hint`}
          />
          <p
            id={`${pasteId}-hint`}
            className="text-[11px] text-[var(--color-muted-foreground)]"
          >
            One email per line is easiest. Comma- or semicolon-separated
            lists work too. Per-row class overrides aren&apos;t supported
            in pasted input. Use CSV for that.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={defaultClassId}>Default class</Label>
          <Select
            id={defaultClassId}
            value={defaultClass}
            onChange={(e) =>
              onChangeDefaultClass(e.target.value as VoterClass)
            }
          >
            {VOTER_CLASS_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {VOTER_CLASS_LABEL[c]}
              </option>
            ))}
          </Select>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            Applied to any row without a recognized voterClass column. CSV
            rows with a recognized class override this.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            loading={importing}
            onClick={() => csvInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" aria-hidden /> Upload CSV
          </Button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={onCsvUpload}
            disabled={importing}
            aria-hidden="true"
            tabIndex={-1}
          />
          <div className="flex-1" />
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={importing}
          >
            Close
          </Button>
          <Button
            type="submit"
            loading={importing}
            disabled={paste.trim() === ""}
          >
            Import pasted emails
          </Button>
        </div>
      </form>
    </Modal>
  );
}
