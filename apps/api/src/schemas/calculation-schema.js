import { z } from "zod";

export const monetaryCorrectionSchema = z.object({
  principalInCents: z.number().int().positive(),
  accumulatedFactor: z.number().positive(),
  indexSlug: z.string().min(1),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
});
