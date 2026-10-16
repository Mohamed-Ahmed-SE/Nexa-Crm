"use client";

import Link from "next/link";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Building2, ContactRound, FilePlus2, Handshake, ListTodo, Search, StickyNote, UserRound, X } from "lucide-react";
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
  { label: "Add Company", href: "/app/companies?create=1", icon: Building2 },
  { label: "Add Deal", href: "/app/deals?create=1", icon: FilePlus2 },
];
const detailRoute = /^\/app\/(leads|contacts|companies|deals)\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const entityTypes = { leads: "lead", contacts: "contact", companies: "company", deals: "deal" } as const;

export function GlobalSearch({ canCreate }: { canCreate: boolean }) {
  const pathname = usePathname();
  const routeMatch = pathname.match(detailRoute);
  const recordContext = routeMatch ? { type: entityTypes[routeMatch[1] as keyof typeof entityTypes], id: routeMatch[2] } : null;
  const taskIntent = routeMatch ? {
    leads: "?createTask=1",
    contacts: "?view=tasks&createTask=1",
    companies: "?section=Tasks&createTask=1",
    deals: "?createTask=1",
  }[routeMatch[1] as keyof typeof entityTypes] : null;
  const taskHref = recordContext && taskIntent ? `${pathname}${taskIntent}` : "/app/tasks?create=1";
  const noteHref = recordContext ? `${pathname}?${routeMatch?.[1] === "companies" ? "section=Notes&" : ""}createNote=1` : null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults>(emptyGlobalSearchResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const requestIdRef = useRef(0);
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  const flatResults = useMemo(() => groups.flatMap(({ key }) => results[key]), [results]);

  useEffect(() => {
    setActiveIndex(-1);
    resultRefs.current = [];
  }, [results]);

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
      const isSearchShortcut = event.key === "/" || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k");
      if (!isSearchShortcut) return;
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

  function moveActiveIndex(nextIndex: number) {
    setActiveIndex(nextIndex);
    resultRefs.current[nextIndex]?.scrollIntoView?.({ block: "nearest" });
  }

  function onDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown") {
      if (!flatResults.length) return;
      event.preventDefault();
      moveActiveIndex(activeIndex < flatResults.length - 1 ? activeIndex + 1 : 0);
      return;
    }
    if (event.key === "ArrowUp") {
      if (!flatResults.length) return;
      event.preventDefault();
      moveActiveIndex(activeIndex > 0 ? activeIndex - 1 : flatResults.length - 1);
      return;
    }
    if (event.key === "Home") {
      if (!flatResults.length) return;
      event.preventDefault();
      moveActiveIndex(0);
      return;
    }
    if (event.key === "End") {
      if (!flatResults.length) return;
      event.preventDefault();
      moveActiveIndex(flatResults.length - 1);
      return;
    }
    if (event.key === "Enter") {
      if (activeIndex < 0 || activeIndex >= flatResults.length) return;
      if (document.activeElement !== inputRef.current) return;
      event.preventDefault();
      resultRefs.current[activeIndex]?.click();
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
      <span aria-hidden="true" className="search-shortcut">⌘ / Ctrl K · /</span>
    </button>
    {open && <div className="global-search-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section aria-labelledby="global-search-title" aria-modal="true" className="global-search-dialog" onKeyDown={onDialogKeyDown} ref={dialogRef} role="dialog">
        <h2 className="sr-only" id="global-search-title">Search this workspace</h2>
        <div className="global-search-input-row">
          <Search aria-hidden="true" size={19} />
          <input aria-activedescendant={activeIndex >= 0 ? `global-search-result-${flatResults[activeIndex]?.id}` : undefined} aria-controls="global-search-listbox" aria-label="Search this workspace" autoComplete="off" onChange={(event) => setQuery(event.target.value)} placeholder="Search leads, contacts, companies, and deals…" ref={inputRef} type="search" value={query} />
          <button aria-label="Close search" className="global-search-close" onClick={close} type="button"><X aria-hidden="true" size={18} /></button>
        </div>
        <div aria-busy={loading} aria-live="polite" className="global-search-content" id="global-search-listbox" role="listbox">
          {loading && <p className="global-search-status">Searching this workspace…</p>}
          {!loading && error && <p className="global-search-status global-search-error" role="alert">{error}</p>}
          {!loading && !error && !query.trim() && <p className="global-search-status">Type a name, title, company, or deal to search.</p>}
          {!loading && !error && query.trim() && hasSearched && totalResults === 0 && <p className="global-search-status">No matching records found.</p>}
          {!loading && !error && groups.map(({ key, label, icon: Icon }) => results[key].length ? <section aria-label={label} className="global-search-group" key={key}>
            <h3><Icon aria-hidden="true" size={14} />{label}</h3>
            <ul role="presentation">{results[key].map((item) => {
              const index = flatResults.indexOf(item);
              return <Result active={index === activeIndex} item={item} key={item.id} onSelect={close} ref={(node) => { resultRefs.current[index] = node; }} />;
            })}</ul>
          </section> : null)}
        </div>
        {canCreate && <nav aria-label="Quick create" className="global-search-actions">
          <span>Quick create</span>
          {[...quickActions, { label: "Add Task", href: taskHref, icon: ListTodo }, ...(noteHref ? [{ label: "Add Note", href: noteHref, icon: StickyNote }] : [])].map(({ label, href, icon: Icon }) => <Link href={href} key={label} onClick={close}><Icon aria-hidden="true" size={15} />{label}</Link>)}
        </nav>}
        <p className="global-search-hint">Search is limited to records in your current workspace.</p>
      </section>
    </div>}
  </>;
}

const Result = forwardRef<HTMLAnchorElement, { item: GlobalSearchItem; active: boolean; onSelect: () => void }>(
  function Result({ item, active, onSelect }, ref) {
    return <li aria-selected={active} id={`global-search-result-${item.id}`} role="option"><Link className={active ? "global-search-result global-search-result-active" : "global-search-result"} href={item.href} onClick={onSelect} ref={ref}>
      <span className="global-search-result-copy"><strong>{item.name}</strong><span>{item.context}</span></span>
      <span className="global-search-result-type">{item.type}</span>
    </Link></li>;
  },
);
