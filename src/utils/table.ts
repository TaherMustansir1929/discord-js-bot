export function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) =>
    Math.max(
      header.length,
      ...rows.map((row) => (row[index] ?? "").length)
    )
  );

  const padRow = (row: string[]) =>
    row
      .map((cell, index) => cell.padEnd(widths[index], " "))
      .join(" | ");

  const headerLine = padRow(headers);
  const divider = widths.map((w) => "-".repeat(w)).join("-|-");
  const body = rows.map((row) => padRow(row)).join("\n");

  return [headerLine, divider, body].filter(Boolean).join("\n");
}
