"use client";

import { AlertCircle } from "lucide-react";
import styles from "./dashboard-workspace.module.css";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className={styles.page}>
    <header className={styles.header}><div><h1>Sales Dashboard</h1><p>Workspace activity and sales work, in one place.</p></div></header>
    <section className={styles.error} role="alert"><AlertCircle aria-hidden="true" size={20} /><div><h2>Dashboard could not be loaded</h2><p>Something interrupted the request. Try again; your workspace records have not been changed.</p><button onClick={reset} type="button">Try again</button></div></section>
  </main>;
}
