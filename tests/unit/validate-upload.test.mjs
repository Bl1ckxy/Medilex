import { test } from 'node:test';
import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { validateUpload, ValidationError, MAX_FILE_SIZE } from '../../src/lib/validate-upload.ts';

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const WEBP_BYTES = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);

function makeFile(bytes, type, name = 'doc') {
    return new File([bytes], name, { type });
}

test('validateUpload: accepts a genuine PDF and returns its bytes', async () => {
    const { buffer, mimeType } = await validateUpload(makeFile(PDF_BYTES, 'application/pdf', 'a.pdf'));
    assert.equal(mimeType, 'application/pdf');
    assert.ok(Buffer.from(buffer).equals(Buffer.from(PDF_BYTES)));
});

test('validateUpload: accepts genuine PNG, JPEG and WebP images', async () => {
    await validateUpload(makeFile(PNG_BYTES, 'image/png', 'a.png'));
    await validateUpload(makeFile(JPEG_BYTES, 'image/jpeg', 'a.jpg'));
    await validateUpload(makeFile(WEBP_BYTES, 'image/webp', 'a.webp'));
});

test('validateUpload: rejects a file whose bytes do not match the declared MIME type', async () => {
    await assert.rejects(
        () => validateUpload(makeFile(PDF_BYTES, 'image/png', 'spoofed.png')),
        (err) => err instanceof ValidationError && err.code === 'UNSUPPORTED_FORMAT' && err.status === 415,
    );
});

test('validateUpload: rejects a WebP container that is actually a RIFF audio file', async () => {
    const wavBytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    await assert.rejects(
        () => validateUpload(makeFile(wavBytes, 'image/webp', 'fake.webp')),
        (err) => err instanceof ValidationError && err.status === 415,
    );
});

test('validateUpload: rejects MIME types outside the allow-list', async () => {
    await assert.rejects(
        () => validateUpload(makeFile(PDF_BYTES, 'application/x-msdownload', 'evil.exe')),
        (err) => err instanceof ValidationError && err.code === 'UNSUPPORTED_FORMAT' && err.status === 415,
    );
    await assert.rejects(
        () => validateUpload(makeFile(PDF_BYTES, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a.docx')),
        (err) => err instanceof ValidationError && err.status === 415,
    );
});

test('validateUpload: rejects files larger than the size limit', async () => {
    const oversized = new Uint8Array(MAX_FILE_SIZE + 1);
    oversized.set(PDF_BYTES, 0);
    await assert.rejects(
        () => validateUpload(makeFile(oversized, 'application/pdf', 'big.pdf')),
        (err) => err instanceof ValidationError && err.code === 'FILE_TOO_LARGE' && err.status === 413,
    );
});
