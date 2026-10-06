import { z } from "zod";

export const notificationIdSchema = z.string().uuid();
export const timezoneOffsetSchema = z.object({
  timezoneOffset: z.number().int().min(-840).max(840),
  tomorrowTimezoneOffset: z.number().int().min(-840).max(840),
});
