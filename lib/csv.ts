import Papa from "papaparse";

export function downloadCsv<T extends Record<string, unknown>>(
  rows: T[],
  filename: string,
): void {
  if (rows.length === 0) {
    const empty = new Blob([""], { type: "text/csv;charset=utf-8;" });
    triggerDownload(empty, filename);
    return;
  }
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
