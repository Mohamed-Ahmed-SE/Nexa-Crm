import { z } from "zod";
import { DATE_FORMATS } from "@/lib/preferences/date-format";

export const dateFormatSchema = z.enum(DATE_FORMATS);
