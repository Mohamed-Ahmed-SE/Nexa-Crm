"use client";

import { useState, useTransition } from "react";
import { getImportJobErrors } from "./history-actions";
import type { ImportJobHistory, ImportRowError } from "@/lib/csv/import-history";
import { useDateFormat } from "@/components/auth/date-format-provider";
import { formatCalendarDate } from "@/lib/preferences/date-format";

const timeWithZone = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });
const countFormat = new Intl.NumberFormat("en");
const entityLabels = { leads: "Leads", contacts: "Contacts", companies: "Companies" } as const;
const statusLabels = { completed: "Completed", completed_with_errors: "Completed with errors", failed: "Failed" } as const;

type Props = { jobs: ImportJobHistory[]; loadError: boolean };

export function ImportHistory({ jobs, loadError }: Props) {
  return <section aria-labelledby="csv-import-history-title" className="csv-import-history">
    <header><h2 id="csv-import-history-title">Import history</h2><p>Recent job summaries and row-numbered errors. Uploaded row contents are not stored.</p></header>
    {loadError ? <p className="csv-import-history-message" role="status">Import history could not be loaded. Try refreshing this page.</p>
      : jobs.length ? <ul className="csv-import-history-list">{jobs.map((job) => <HistoryJob key={job.id} job={job} />)}</ul>
        : <p className="csv-import-history-message">No imports have been run in this workspace.</p>}
  </section>;
}

function HistoryJob({ job }: { job: ImportJobHistory }) {
  const dateFormat = useDateFormat();
  const createdAt = new Date(job.created_at);
  return <li className="csv-import-history-job">
    <div className="csv-import-history-summary">
      <div><strong>{entityLabels[job.entity]}</strong><time dateTime={job.created_at}>{formatCalendarDate(createdAt, dateFormat, { timeZone: "UTC" })}, {timeWithZone.format(createdAt)}</time></div>
      <span className={`csv-import-history-status csv-import-history-status-${job.status}`}>{statusLabels[job.status]}</span>
      <p>{countFormat.format(job.imported_rows)} imported · {countFormat.format(job.rejected_rows)} rejected · {countFormat.format(job.total_rows)} total</p>
    </div>
    {job.rejected_rows > 0 && <ImportErrorReport jobId={job.id} rejectedRows={job.rejected_rows} />}
  </li>;
}

function ImportErrorReport({ jobId, rejectedRows }: { jobId: string; rejectedRows: number }) {
  const [expanded, setExpanded] = useState(false);
  const [errors, setErrors] = useState<ImportRowError[] | null>(null);
  const [loadMessage, setLoadMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggleReport() {
    if (isPending) return;
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (errors) return;
    setLoadMessage("");
    startTransition(async () => {
      const result = await getImportJobErrors(jobId);
      if (result.ok) setErrors(result.errors);
      else setLoadMessage(result.message);
    });
  }

  return <div className="csv-import-history-report">
    <button aria-controls={`import-errors-${jobId}`} aria-expanded={expanded} className="csv-import-history-toggle" disabled={isPending} onClick={toggleReport} type="button">
      {isPending ? "Loading errors…" : expanded ? "Hide row errors" : `View ${countFormat.format(rejectedRows)} row errors`}
    </button>
    <div aria-live="polite" hidden={!expanded} id={`import-errors-${jobId}`}>
      {expanded && (loadMessage ? <p className="csv-import-history-message" role="alert">{loadMessage}</p>
        : errors ? <ol className="csv-import-history-errors">{errors.map((entry) => <li key={entry.row}><strong>Row {entry.row}:</strong> {entry.errors.join("; ")}</li>)}</ol>
          : <p className="csv-import-history-message" role="status">Loading saved row errors.</p>)}
    </div>
  </div>;
}
