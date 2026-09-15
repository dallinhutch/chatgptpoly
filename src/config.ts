import { z } from "zod";
const fraction = z.number().min(0).max(1);
export const strategySchema = z
  .object({
    minConfidence: fraction.default(0.8),
    minEdge: fraction.default(0.12),
    minQuality: fraction.default(0.8),
    maxDisagreement: fraction.default(0.1),
    minLiquidity: z.number().min(0).default(1000),
    maxPosition: fraction.default(0.03),
    maxExposure: fraction.default(0.3),
    maxCategory: fraction.default(0.15),
    maxCorrelated: fraction.default(0.06),
    cashReserve: fraction.default(0.5),
    kellyFraction: z.number().min(0).max(0.25).default(0.1),
    maxDrawdown: fraction.default(0.15),
    maxBookAgeSeconds: z.number().min(1).max(60).default(15),
    maxResearchAgeHours: z.number().min(1).max(48).default(6),
    minHoursRemaining: z.number().min(0).default(2),
    maxSpread: fraction.default(0.08),
    feeBuffer: fraction.default(0.03),
  })
  .strict();
export type Strategy = z.infer<typeof strategySchema>;
export const defaults = strategySchema.parse({});
