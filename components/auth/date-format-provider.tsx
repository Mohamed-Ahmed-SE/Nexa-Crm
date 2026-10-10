"use client";

import { createContext, useContext } from "react";
import type { DateFormat } from "@/lib/preferences/date-format";

const DateFormatContext = createContext<DateFormat>("MM/DD/YYYY");

export function DateFormatProvider({ children, dateFormat }: { children: React.ReactNode; dateFormat: DateFormat }) {
  return <DateFormatContext.Provider value={dateFormat}>{children}</DateFormatContext.Provider>;
}

export function useDateFormat(): DateFormat {
  return useContext(DateFormatContext);
}
