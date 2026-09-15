import {z} from 'zod';
const fraction=z.number().min(0).max(1);
export const strategySchema=z.object({minConfidence:fraction.default(.8),minEdge:fraction.default(.12),minQuality:fraction.default(.8),maxDisagreement:fraction.default(.1),minLiquidity:z.number().min(0).default(1000),maxPosition:fraction.default(.03),maxExposure:fraction.default(.3),maxCategory:fraction.default(.15),maxCorrelated:fraction.default(.06),cashReserve:fraction.default(.5),kellyFraction:z.number().min(0).max(.25).default(.1),maxDrawdown:fraction.default(.15),maxBookAgeSeconds:z.number().min(1).max(60).default(15),maxResearchAgeHours:z.number().min(1).max(48).default(6),minHoursRemaining:z.number().min(0).default(2),maxSpread:fraction.default(.08),feeBuffer:fraction.default(.03)}).strict();
export type Strategy=z.infer<typeof strategySchema>;
export const defaults=strategySchema.parse({});
