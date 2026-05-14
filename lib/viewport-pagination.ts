interface PageSizeInput {
  mediaHeight: number | null | undefined;
  rowHeight: number;
  minRows: number;
  fallbackRows?: number;
}

export function getPageSizeForMediaHeight({
  mediaHeight,
  rowHeight,
  minRows,
  fallbackRows = minRows,
}: PageSizeInput): number {
  if (!mediaHeight || mediaHeight <= 0 || rowHeight <= 0) {
    return Math.max(1, fallbackRows);
  }

  return Math.max(minRows, Math.floor(mediaHeight / rowHeight));
}

interface GridPageSizeInput extends PageSizeInput {
  columns: number;
}

export function getGridPageSizeForMediaHeight({
  columns,
  ...input
}: GridPageSizeInput): number {
  const safeColumns = Math.max(1, columns);
  const visibleRows = getPageSizeForMediaHeight(input);

  return visibleRows * safeColumns;
}
