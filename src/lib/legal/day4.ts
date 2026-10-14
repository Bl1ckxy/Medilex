import { z } from 'zod';

export const VerificationRequestSchema = z.object({
    caseId: z.string().uuid(),
    analysis: z.unknown().optional(),
});
export type VerificationRequest = z.infer<typeof VerificationRequestSchema>;

export const LawyerReviewRequestSchema = z.object({
    caseId: z.string().uuid(),
    focus: z.string().max(2000).optional(),
});
export type LawyerReviewRequest = z.infer<typeof LawyerReviewRequestSchema>;

export const StrengthResultSchema = z.object({
    score: z.number().min(0).max(100),
    label: z.enum(['Weak', 'Moderate', 'Strong', 'Very Strong']),
    pillars: z.object({
        evidence: z.number().min(0).max(100),
        breach: z.number().min(0).max(100),
        causation: z.number().min(0).max(100),
        damages: z.number().min(0).max(100),
        procedure: z.number().min(0).max(100),
    }),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    missingEvidence: z.array(z.string()),
    nextSteps: z.array(z.string()),
    authorities: z.array(z.string()),
    deviationReason: z.string().max(1500).optional(),
    confidence: z.number().min(0).max(1),
});
export type StrengthResult = z.infer<typeof StrengthResultSchema>;
