"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseCsv } from "@/lib/csv/csv";
import { importFields, mappedCsvRow, suggestedMappings, validateImportRow, type ImportEntity } from "@/lib/csv/import";
import { isImportPayloadWithinLimit, MAX_CSV_BYTES } from "@/lib/csv/limits";
import type { ImportJobHistory } from "@/lib/csv/import-history";
import { ImportHistory } from "./import-history";
import { importCsvAction } from "./actions";

type ParsedFile = { headers: string[]; rows: string[][] };
const entities: { value: ImportEntity; label: string }[] = [{ value: "leads", label: "Leads" }, { value: "contacts", label: "Contacts" }, { value: "companies", label: "Companies" }];

export function ImportWorkspace({ initialEntity, historyJobs, historyError }: { initialEntity: ImportEntity; historyJobs: ImportJobHistory[]; historyError: boolean }) {
  const [entity, setEntity] = useState<ImportEntity>(initialEntity);
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof importCsvAction>> | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const fields = importFields[entity];
  const mappedRows = file?.rows.map((row) => mappedCsvRow(file.headers, row, mapping, entity)) ?? [];
  const invalidCount = mappedRows.filter((row) => !validateImportRow(entity, row).success).length;
  const duplicates = new Set<string>();
  const duplicateRows = new Set<number>();
  for (const [index, row] of mappedRows.entries()) {
    const identifier = row.email || row.fullName || row.name || row.companyName || [row.firstName, row.lastName].filter(Boolean).join(" ");
    const fingerprint = String(identifier ?? "").toLowerCase().trim();
    if (fingerprint && duplicates.has(fingerprint)) duplicateRows.add(index + 2);
    if (fingerprint) duplicates.add(fingerprint);
  }

  function chooseEntity(value: ImportEntity) {
    setEntity(value); setFile(null); setMapping([]); setError(""); setSummary(null);
  }
  async function readFile(selected: File | undefined) {
    if (!selected) return;
    setError(""); setSummary(null);
    try {
      if (!selected.name.toLowerCase().endsWith(".csv")) throw new Error("Choose a .csv file.");
      if (selected.size > MAX_CSV_BYTES) throw new Error("CSV files must be 5 MB or smaller.");
      const parsedFile = parseCsv(await selected.text());
      setFile(parsedFile); setMapping(suggestedMappings(entity, parsedFile.headers));
    } catch (caught) { setFile(null); setError(caught instanceof Error ? caught.message : "This CSV could not be read."); }
  }
  function updateMapping(fieldIndex: number, columnIndex: number) {
    setMapping((current) => current.map((mappedColumn, index) => index === fieldIndex ? columnIndex : mappedColumn));
  }
  function submitImport() {
    if (!file) return;
    if (fields.some((field, index) => field.required && mapping[index] < 0)) { setError("Map each required field before importing."); return; }
    const payload = mappedRows.map((row) => ({ ...row, status: row.status || "new", lifecycleStatus: row.lifecycleStatus || "active" }));
    const serializedRows = JSON.stringify(payload);
    if (!isImportPayloadWithinLimit(serializedRows)) { setError("Mapped import data exceeds 32 MB. Split the CSV into smaller files and try again."); return; }
    const formData = new FormData(); formData.set("entity", entity); formData.set("rows", serializedRows);
    setError("");
    startTransition(async () => {
      const result = await importCsvAction(formData);
      setSummary(result);
      if (result.ok) router.refresh();
    });
  }

  return <main className="page-container leads-page csv-import-page">
    <header className="leads-header"><div><h1 className="page-title">Import CSV</h1><p className="page-description">Create new workspace records from a CSV file. Existing records are never changed.</p></div><a className="leads-secondary-button" href={`/app/${entity}`}>Back to {entity}</a></header>
    <section className="leads-panel csv-import-panel">
      <div className="leads-form-grid csv-import-controls">
        <label className="leads-field"><span>Import to</span><select value={entity} onChange={(event) => chooseEntity(event.target.value as ImportEntity)}>{entities.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="leads-field"><span>CSV file (up to 5 MB)</span><input accept=".csv,text/csv" onChange={(event) => void readFile(event.target.files?.[0])} type="file" /></label>
      </div>
      {file && <>
        <section aria-label="Map CSV columns" className="csv-import-mapping"><h2>Map columns</h2><p>Choose which CSV column supplies each field. Required fields are marked.</p><div className="csv-map-list">{fields.map((field, index) => <label className="csv-map-row" key={field.key}><span>{field.label}{field.required ? " · Required" : ""}</span><select aria-label={`${field.label} column`} onChange={(event) => updateMapping(index, Number(event.target.value))} value={mapping[index] ?? -1}><option value={-1}>Do not import</option>{file.headers.map((header, columnIndex) => <option key={`${columnIndex}-${header}`} value={columnIndex}>{header}</option>)}</select></label>)}</div></section>
        <section aria-label="Import preview" className="csv-import-preview"><h2>Preview and validation</h2><p>{file.rows.length} rows detected · {invalidCount} currently invalid · create-only import</p>{duplicateRows.size > 0 && <p className="csv-import-warning" role="status">Possible duplicates within this file at rows {Array.from(duplicateRows).join(", ")}. They will still be imported as new records.</p>}
          <div className="companies-table-wrap"><table className="leads-table"><thead><tr><th>CSV row</th>{fields.slice(0, 4).map((field) => <th key={field.key}>{field.label}</th>)}<th>Validation</th></tr></thead><tbody>{mappedRows.slice(0, 10).map((row, index) => { const parsed = validateImportRow(entity, row); return <tr key={index}><td>{index + 2}</td>{fields.slice(0, 4).map((field) => <td key={field.key}>{row[field.key] || "—"}</td>)}<td>{parsed.success ? "Ready" : parsed.error.issues[0]?.message}</td></tr>; })}</tbody></table></div>{file.rows.length > 10 && <p>Showing first 10 rows. All {file.rows.length} rows are validated when imported.</p>}
        </section>
        <footer className="leads-form-footer"><button className="leads-primary-button" disabled={pending || file.rows.length === 0} onClick={submitImport} type="button">{pending ? "Importing…" : `Import ${file.rows.length} rows`}</button></footer>
      </>}
      {error && <p className="leads-form-message" role="alert">{error}</p>}
      {summary && <section aria-live="polite" className="csv-import-summary"><h2>{summary.ok ? "Import summary" : "Import could not finish"}</h2><p>{summary.message}</p>{summary.errors.length > 0 && <div className="csv-import-errors"><h3>Rows to review</h3><ul>{summary.errors.map((failure) => <li key={failure.row}>Row {failure.row}: {failure.errors.join("; ")}</li>)}</ul></div>}<a className="leads-secondary-button" href={`/app/${entity}`}>View {entity}</a></section>}
    </section>
    <ImportHistory jobs={historyJobs} loadError={historyError} />
  </main>;
}
