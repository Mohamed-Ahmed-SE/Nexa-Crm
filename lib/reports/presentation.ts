export function calculateWinRate(won: number, lost: number) {
  const closed = won + lost;
  return closed ? `${Math.round((won / closed) * 100)}%` : "—";
}

export function buildReportCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
