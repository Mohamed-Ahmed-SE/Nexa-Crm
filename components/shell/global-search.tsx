"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, ContactRound, FilePlus2, Handshake, Search, UserRound, X } from "lucide-react";
import { globalSearchAction } from "@/lib/search/actions";
import { emptyGlobalSearchResults, type GlobalSearchItem, type GlobalSearchKind, type GlobalSearchResults } from "@/lib/search/global-search";

const groups: Array<{ key: GlobalSearchKind; label: string; icon: typeof UserRound }> = [
  { key: "lead", label: "Leads", icon: UserRound },
  { key: "contact", label: "Contacts", icon: ContactRound },
  { key: "company", label: "Companies", icon: Building2 },
  { key: "deal", label: "Deals", icon: Handshake },
];
const quickActions = [
  { label: "Add Lead", href: "/app/leads?create=1", icon: UserRound },
  { label: "Add Contact", href: "/app/contacts?create=1", icon: ContactRound },
  { label: "Add Deal", href: "/app/deals?create=1", icon: FilePlus2 },
];

export function GlobalSearch({ canCreate }: { canCreate: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults>(emptyGlobalSearchResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const requestIdRef = useRef(0);

  const show = useCallback(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    requestIdRef.current += 1;
    setLoading(false);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [role='textbox']"))) return;
      event.preventDefault();
      show();
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [show]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (!term) {
      requestIdRef.current += 1;
      setResults(emptyGlobalSearchResults());
      setLoading(false);
      setError("");
      setHasSearched(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    const timer = window.setTimeout(() => {
      void globalSearchAction(term).then((response) => {
        if (requestIdRef.current !== requestId) return;
        if (!response.ok) {
          setError(response.message);
          setResults(emptyGlobalSearchResults());
        } else {
          setResults(response.results);
          setHasSearched(true);
        }
      }).catch(() => {
        if (requestIdRef.current !== requestId) return;
        setError("Search could not be completed. Please try again.");
        setResults(emptyGlobalSearchResults());
      }).finally(() => {
        if (requestIdRef.current === requestId) setLoading(false);
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  function onDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled])"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  const totalResults = groups.reduce((count, group) => count + results[group.key].length, 0);

  return <>
    <button aria-haspopup="dialog" aria-label="Search CRM" className="global-search global-search-trigger" onClick={show} type="button">
      <Search aria-hidden="true" size={17} />
      <span className="global-search-trigger-label">Search CRM</span>
      <span aria-hidden="true" className="search-shortcut">⌘ / Ctrl K</span>
    </button>
    {open && <div className="global-search-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section aria-labelledby="global-search-title" aria-modal="true" className="global-search-dialog" onKeyDown={onDialogKeyDown} ref={dialogRef} role="dialog">
        <h2 className="sr-only" id="global-search-title">Search this workspace</h2>
        <div className="global-search-input-row">
          <Search aria-hidden="true" size={19} />
          <input aria-label="Search this workspace" autoComplete="off" onChange={(event) => setQuery(event.target.value)} placeholder="Search leads, contacts, companies, and deals…" ref={inputRef} type="search" value={query} />
          <button aria-label="Close search" className="global-search-close" onClick={close} type="button"><X aria-hidden="true" size={18} /></button>
        </div>
        <div aria-busy={loading} aria-live="polite" className="global-search-content">
          {loading && <p className="global-search-status">Searching this workspace…</p>}
          {!loading && error && <p className="global-search-status global-search-error" role="alert">{error}</p>}
          {!loading && !error && !query.trim() && <p className="global-search-status">Type a name, title, company, or deal to search.</p>}
          {!loading && !error && query.trim() && hasSearched && totalResults === 0 && <p className="global-search-status">No matching records found.</p>}
          {!loading && !error && groups.map(({ key, label, icon: Icon }) => results[key].length ? <section aria-label={label} className="global-search-group" key={key}>
            <h3><Icon aria-hidden="true" size={14} />{label}</h3>
            <ul>{results[key].map((item) => <Result key={item.id} item={item} onSelect={close} />)}</ul>
          </section> : null)}
        </div>
        {canCreate && <nav aria-label="Quick create" className="global-search-actions">
          <span>Quick create</span>
          {quickActions.map(({ label, href, icon: Icon }) => <Link href={href} key={label} onClick={close}><Icon aria-hidden="true" size={15} />{label}</Link>)}
        </nav>}
        <p className="global-search-hint">Search is limited to records in your current workspace.</p>
      </section>
    </div>}
  </>;
}

function Result({ item, onSelect }: { item: GlobalSearchItem; onSelect: () => void }) {
  return <li><Link className="global-search-result" href={item.href} onClick={onSelect}>
    <span className="global-search-result-copy"><strong>{item.name}</strong><span>{item.context}</span></span>
    <span className="global-search-result-type">{item.type}</span>
  </Link></li>;
}
