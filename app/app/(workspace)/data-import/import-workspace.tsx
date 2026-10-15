"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseCsv } from "@/lib/csv/csv";
import { importFields, mappedCsvRow, suggestedMappings, validateImportRow, type ImportEntity } from "@/lib/csv/import";
import { isImportPayloadWithinLimit, MAX_CSV_BYTES } from "@/lib/csv/limits";
import type { ImportJobHistory } from "@/lib/csv/import-history";
import { ImportHistory } from "./import-history";
import { importCsvAction } from "./actions";

type ParsedFile = { headers: string[]; rows: string[][] };
const entities: { value: ImportEntity; label: string }[] = [{ value: "leads", label: "Leads" }, { value: "contacts", label: "Contacts" }, { value: "companies", label: "Companies" }];
const steps = ["Upload CSV", "Map columns", "Preview / validation", "Confirm", "Result summary"] as const;

function createImportPayload(rows: ReturnType<typeof mappedCsvRow>[]) {
  return rows.map((row) => ({ ...row, status: row.status || "new", lifecycleStatus: row.lifecycleStatus || "active" }));
}

export function ImportWorkspace({ initialEntity, historyJobs, historyError }: { initialEntity: ImportEntity; historyJobs: ImportJobHistory[]; historyError: boolean }) {
  const [entity, setEntity] = useState<ImportEntity>(initialEntity);
  const [file, setFile] = useState<ParsedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mapping, setMapping] = useState<number[]>([]);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof importCsvAction>> | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const fields = importFields[entity];
  const mappedRows = file?.rows.map((row) => mappedCsvRow(file.headers, row, mapping, entity)) ?? [];
  const validations = mappedRows.map((row) => validateImportRow(entity, row));
  const invalidCount = validations.filter((validation) => !validation.success).length;
  const validCount = mappedRows.length - invalidCount;
  const duplicates = new Set<string>();
  const duplicateRows = new Set<number>();
  for (const [index, row] of mappedRows.entries()) {
    const identifier = row.email || row.fullName || row.name || row.companyName || [row.firstName, row.lastName].filter(Boolean).join(" ");
    const fingerprint = String(identifier ?? "").toLowerCase().trim();
    if (fingerprint && duplicates.has(fingerprint)) duplicateRows.add(index + 2);
    if (fingerprint) duplicates.add(fingerprint);
  }

  function chooseEntity(value: ImportEntity) {
    setEntity(value); setFile(null); setMapping([]); setStep(1); setError(""); setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  function cancelAndFixFile() {
    setFile(null); setMapping([]); setStep(1); setError(""); setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  async function readFile(selected: File | undefined) {
    if (!selected) return;
    setError(""); setSummary(null);
    try {
      if (!selected.name.toLowerCase().endsWith(".csv")) throw new Error("Choose a .csv file.");
      if (selected.size > MAX_CSV_BYTES) throw new Error("CSV files must be 5 MB or smaller.");
      const parsedFile = parseCsv(await selected.text());
      setFile(parsedFile); setMapping(suggestedMappings(entity, parsedFile.headers)); setStep(2);
    } catch (caught) { setFile(null); setError(caught instanceof Error ? caught.message : "This CSV could not be read."); }
  }
  function updateMapping(fieldIndex: number, columnIndex: number) {
    setMapping((current) => current.map((mappedColumn, index) => index === fieldIndex ? columnIndex : mappedColumn));
  }
  function reviewPreview() {
    if (fields.some((field, index) => field.required && mapping[index] < 0)) {
      setError("Map each required field before reviewing the preview.");
      return;
    }
    setError(""); setStep(3);
  }
  function reviewConfirmation() {
    const payload = createImportPayload(mappedRows);
    if (!isImportPayloadWithinLimit(JSON.stringify(payload))) {
      setError("Mapped import data exceeds 32 MB. Split the CSV into smaller files and try again.");
      return;
    }
    setError(""); setStep(4);
  }
  function submitImport() {
    if (!file) return;
    const payload = createImportPayload(mappedRows);
    const formData = new FormData(); formData.set("entity", entity); formData.set("rows", JSON.stringify(payload));
    setError("");
    startTransition(async () => {
      const importSummary = await importCsvAction(formData);
      setSummary(importSummary); setStep(5);
      if (importSummary.ok) router.refresh();
    });
  }

  return <main className="page-container leads-page csv-import-page">
    <header className="leads-header"><div><h1 className="page-title">Import CSV</h1><p className="page-description">Create new workspace records from a CSV file. Existing records are never changed.</p></div><a className="leads-secondary-button" href={`/app/${entity}`}>Back to {entity}</a></header>
    <section className="leads-panel csv-import-panel">
      <nav aria-label="CSV import progress" className="csv-import-progress"><ol>{steps.map((label, index) => <li aria-current={step === index + 1 ? "step" : undefined} className={step === index + 1 ? "is-current" : undefined} key={label}><span>{index + 1}</span><span>{label}</span></li>)}</ol></nav>
      {step === 1 && <section aria-labelledby="csv-upload-title" className="csv-import-controls">
        <h2 id="csv-upload-title">Upload CSV</h2>
        <div className="leads-form-grid">
          <label className="leads-field"><span>Import to</span><select value={entity} onChange={(event) => chooseEntity(event.target.value as ImportEntity)}>{entities.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="leads-field"><span>CSV file (up to 5 MB)</span><input accept=".csv,text/csv" onChange={(event) => void readFile(event.target.files?.[0])} ref={fileInputRef} type="file" /></label>
        </div>
      </section>}
      {step === 2 && file && <section aria-label="Map CSV columns" className="csv-import-mapping"><h2>Map columns</h2><p>{file.headers.length} columns detected. Suggested mappings are selected where available.</p><div className="csv-map-list">{fields.map((field, index) => <label className="csv-map-row" key={field.key}><span>{field.label}{field.required ? " · Required" : ""}</span><select aria-label={`${field.label} column`} onChange={(event) => updateMapping(index, Number(event.target.value))} value={mapping[index] ?? -1}><option value={-1}>Do not import</option>{file.headers.map((header, columnIndex) => <option key={`${columnIndex}-${header}`} value={columnIndex}>{header}</option>)}</select></label>)}</div></section>}
      {step === 3 && file && <section aria-label="Import preview" className="csv-import-preview"><h2>Preview and validation</h2><p>{file.rows.length} {file.rows.length === 1 ? "row" : "rows"} detected · {validCount} valid · {invalidCount} invalid · create-only import</p>{duplicateRows.size > 0 && <p className="csv-import-warning" role="status">Possible duplicates within this file at rows {Array.from(duplicateRows).join(", ")}. They will still be imported as new records.</p>}
        <div className="companies-table-wrap"><table className="leads-table"><thead><tr><th>CSV row</th>{fields.slice(0, 4).map((field) => <th key={field.key}>{field.label}</th>)}<th>Validation</th></tr></thead><tbody>{mappedRows.slice(0, 10).map((row, index) => { const validation = validations[index]; return <tr key={index}><td>{index + 2}</td>{fields.slice(0, 4).map((field) => <td key={field.key}>{row[field.key] || "—"}</td>)}<td>{validation.success ? "Ready" : validation.error.issues[0]?.message}</td></tr>; })}</tbody></table></div>{file.rows.length > 10 && <p>Showing first 10 rows. All {file.rows.length} rows are validated before import.</p>}
        {invalidCount > 0 && <section aria-labelledby="csv-import-invalid-title" className="csv-import-errors"><h3 id="csv-import-invalid-title">Invalid rows to skip</h3><ul>{validations.map((validation, index) => !validation.success && <li key={index}>Row {index + 2}: {validation.error.issues.map((issue) => issue.message).join("; ")}</li>)}</ul></section>}
        <p role="status">{validCount} {validCount === 1 ? "valid row passes" : "valid rows pass"} preview validation and will be submitted; {invalidCount} {invalidCount === 1 ? "invalid preview row will" : "invalid preview rows will"} be skipped. Additional import failures will be shown in the summary.</p>
      </section>}
      {step === 4 && file && <section aria-labelledby="csv-confirm-title" className="csv-import-preview"><h2 id="csv-confirm-title">Confirm import</h2><p>You are about to create {validCount} {validCount === 1 ? "new record" : "new records"} in {entity}. Existing records will not be changed.</p><p>{invalidCount} invalid {invalidCount === 1 ? "row will" : "rows will"} be skipped{duplicateRows.size ? `; possible duplicate rows ${Array.from(duplicateRows).join(", ")} will still be created` : ""}.</p><p>Review the preview before confirming. This action cannot be undone.</p></section>}
      {step === 5 && summary && <section aria-live="polite" className="csv-import-summary"><h2>{summary.ok ? "Import summary" : "Import could not finish"}</h2><p>{summary.message}</p>{summary.errors.length > 0 && <div className="csv-import-errors"><h3>Rows to review</h3><ul>{summary.errors.map((failure) => <li key={failure.row}>Row {failure.row}: {failure.errors.join("; ")}</li>)}</ul></div>}<a className="leads-secondary-button" href={`/app/${entity}`}>View {entity}</a></section>}
      {error && <p className="leads-form-message" role="alert">{error}</p>}
      <footer className="leads-form-footer">
        {step > 1 && step < 5 && <><button className="leads-secondary-button" disabled={pending} onClick={() => { setError(""); setStep(step - 1); }} type="button">Back</button><button className="leads-secondary-button" disabled={pending} onClick={cancelAndFixFile} type="button">Cancel and fix file</button></>}
        {step === 2 && <button className="leads-primary-button" disabled={pending || !file} onClick={reviewPreview} type="button">Review preview</button>}
        {step === 3 && <button className="leads-primary-button" disabled={pending || file?.rows.length === 0} onClick={reviewConfirmation} type="button">Continue to confirmation</button>}
        {step === 4 && <button className="leads-primary-button" disabled={pending || !file || file.rows.length === 0} onClick={submitImport} type="button">{pending ? "Importing…" : `Confirm and import ${validCount} valid ${validCount === 1 ? "row" : "rows"}${invalidCount ? ` · Skip ${invalidCount} invalid` : ""}`}</button>}
      </footer>
    </section>
    <ImportHistory jobs={historyJobs} loadError={historyError} />
  </main>;
}
