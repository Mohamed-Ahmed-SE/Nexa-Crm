"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function useCreateIntent(createIntent: boolean, canCreate: boolean, openCreateForm: () => void) {
  const router = useRouter();
  const consumedIntent = useRef(false);

  useEffect(() => {
    if (!createIntent) {
      consumedIntent.current = false;
      return;
    }
    if (!canCreate || consumedIntent.current) return;
    consumedIntent.current = true;
    openCreateForm();
    const url = new URL(window.location.href);
    url.searchParams.delete("create");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [canCreate, createIntent, openCreateForm, router]);
}
