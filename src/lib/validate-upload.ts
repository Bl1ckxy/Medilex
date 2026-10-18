// src/lib/validate-upload.ts
// Server-side upload guard: size limit, MIME allow-list, and magic-byte
// verification of the actual file content. `file.type` is attacker-controlled
// metadata, so the declared type is only trusted once the leading bytes agree.

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

type Signature = { offset: number; bytes: number[] };

// Every signature listed for a type must match (not "any of"), which is what
// lets WebP require RIFF at 0 AND WEBP at 8 — a WAV/AVI file shares the RIFF
// prefix but not the payload marker.
const MAGIC_BYTES: Record<string, Signature[]> = {
    'application/pdf': [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
    'image/png': [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }],
    'image/jpeg': [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
    'image/webp': [
        { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
        { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // WEBP
    ],
};

const ALLOWED_MIME_TYPES = Object.keys(MAGIC_BYTES);

export type UploadErrorCode = 'FILE_TOO_LARGE' | 'UNSUPPORTED_FORMAT';

export class ValidationError extends Error {
    readonly status: number;
    readonly code: UploadErrorCode;

    constructor(message: string, code: UploadErrorCode, status: number) {
        super(message);
        this.name = 'ValidationError';
        this.code = code;
        this.status = status;
    }
}

function matchesSignatures(header: Uint8Array, signatures: Signature[]): boolean {
    return signatures.every((signature) => {
        if (header.length < signature.offset + signature.bytes.length) return false;
        return signature.bytes.every((byte, index) => header[signature.offset + index] === byte);
    });
}

export async function validateUpload(file: File): Promise<{ buffer: Buffer; mimeType: string }> {
    if (file.size > MAX_FILE_SIZE) {
        throw new ValidationError(
            `File size exceeds the 10MB limit. Actual size: ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
            'FILE_TOO_LARGE',
            413,
        );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new ValidationError(
            `File type '${file.type}' is not allowed. Allowed types: PDF, PNG, JPEG, WebP.`,
            'UNSUPPORTED_FORMAT',
            415,
        );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const header = new Uint8Array(buffer.subarray(0, 16));

    const signatures = MAGIC_BYTES[file.type];
    if (!signatures || !matchesSignatures(header, signatures)) {
        throw new ValidationError(
            `File content does not match the declared type '${file.type}'. The file may be corrupted or malicious.`,
            'UNSUPPORTED_FORMAT',
            415,
        );
    }

    return { buffer, mimeType: file.type };
}
