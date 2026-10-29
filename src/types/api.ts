import { z } from 'zod';
import {
    CASE_STATUSES,
    DOCUMENT_CATEGORIES,
    FORUM_TYPES,
    HOSPITAL_TYPES,
    NEGLIGENCE_TYPES,
    SEVERITY_LEVELS,
} from './legal';

// --------------------------------------------------------------------------
// Error codes
// --------------------------------------------------------------------------

export const ERROR_CODES = {
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    HASH_MISMATCH: 'HASH_MISMATCH',
    UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    PAGE_COUNT_EXCEEDED: 'PAGE_COUNT_EXCEEDED',
    OCR_FAILED: 'OCR_FAILED',
    EMBEDDING_FAILED: 'EMBEDDING_FAILED',
    LLM_ERROR: 'LLM_ERROR',
    LLM_UNAVAILABLE: 'LLM_UNAVAILABLE',
    NO_DOCUMENTS: 'NO_DOCUMENTS',
    RATE_LIMITED: 'RATE_LIMITED',
    CONFLICT: 'CONFLICT',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// --------------------------------------------------------------------------
// Generic API response wrappers
// --------------------------------------------------------------------------

export interface ApiError {
    code: ErrorCode;
    message: string;
    details?: unknown;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: ApiError;
}

export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface PaginatedResponse<T> {
    items: T[];
    pagination: PaginationMeta;
}

// --------------------------------------------------------------------------
// Case schemas
// --------------------------------------------------------------------------

export const CreateCaseSchema = z
    .object({
        patientName: z
            .string()
            .min(2, 'Patient name must be at least 2 characters')
            .max(200, 'Patient name must not exceed 200 characters'),
        patientAge: z
            .number()
            .int('Age must be a whole number')
            .min(0, 'Age cannot be negative')
            .max(130, 'Age cannot exceed 130'),
        patientGender: z.enum(['male', 'female', 'other']),
        nextOfKin: z
            .string()
            .max(200, 'Next of kin name must not exceed 200 characters')
            .optional(),
        nextOfKinRelation: z.string().max(100, 'Relationship must not exceed 100 characters').optional(),
        hospitalName: z
            .string()
            .min(2, 'Hospital name must be at least 2 characters')
            .max(300, 'Hospital name must not exceed 300 characters'),
        hospitalType: z.enum(HOSPITAL_TYPES),
        hospitalCity: z
            .string()
            .min(2, 'City name must be at least 2 characters')
            .max(100, 'City name must not exceed 100 characters'),
        hospitalState: z
            .string()
            .min(2, 'State name must be at least 2 characters')
            .max(100, 'State name must not exceed 100 characters'),
        negligenceType: z.enum(NEGLIGENCE_TYPES),
        severity: z.enum(SEVERITY_LEVELS),
        incidentDate: z
            .string()
            .datetime({ offset: true })
            .refine(
                (val) => new Date(val) < new Date(),
                'Incident date must be in the past',
            ),
        incidentDescription: z
            .string()
            .min(10, 'Description must be at least 10 characters')
            .max(10000, 'Description must not exceed 10,000 characters'),
        claimAmount: z.number().positive('Claim amount must be positive'),
        treatingDoctorName: z
            .string()
            .min(2, 'Doctor name must be at least 2 characters')
            .max(200, 'Doctor name must not exceed 200 characters')
            .optional(),
        treatingDoctorRegistration: z
            .string()
            .max(100, 'Registration number must not exceed 100 characters')
            .optional(),
    })
    .refine(
        (data) => {
            if (data.severity === 'death') {
                return (
                    data.nextOfKin?.trim().length &&
                    data.nextOfKinRelation?.trim().length
                );
            }
            return true;
        },
        {
            message: 'Next of kin and relationship are required when severity is death',
            path: ['nextOfKin'],
        },
    );

export type CreateCaseInput = z.infer<typeof CreateCaseSchema>;

export const UpdateCaseSchema = z
    .object({
    status: z.enum(CASE_STATUSES).optional(),
    assignedTo: z.string().uuid('Invalid user ID').optional(),
    incidentDescription: z
        .string()
        .min(10, 'Description must be at least 10 characters')
        .max(10000, 'Description must not exceed 10,000 characters')
        .optional(),
    filedForum: z.enum(FORUM_TYPES).optional(),
    complaintNumber: z
        .string()
        .max(100, 'Complaint number must not exceed 100 characters')
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, 'At least one case field is required');

export type UpdateCaseInput = z.infer<typeof UpdateCaseSchema>;

// --------------------------------------------------------------------------
// Document schemas
// --------------------------------------------------------------------------

export const UploadDocumentSchema = z.object({
    caseId: z.string().uuid('Invalid case ID'),
    documentCategory: z.enum(DOCUMENT_CATEGORIES),
    clientHash: z
        .string()
        .length(64, 'Client hash must be exactly 64 characters')
        .regex(/^[a-f0-9]+$/, 'Client hash must be a valid hex string'),
});

export type UploadDocumentInput = z.infer<typeof UploadDocumentSchema>;

// --------------------------------------------------------------------------
// Analysis schemas
// --------------------------------------------------------------------------

export const AnalyzeRequestSchema = z.object({
    caseId: z.string().uuid('Invalid case ID'),
});

export type AnalyzeRequestInput = z.infer<typeof AnalyzeRequestSchema>;
// âœ“ FILE COMPLETE â€” src/types/api.ts