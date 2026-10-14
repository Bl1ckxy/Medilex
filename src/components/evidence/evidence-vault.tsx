// ✓ FILE COMPLETE — evidence-vault.tsx
'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Download, FileArchive, FileText, Loader2, Plus, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS, type DocumentCategory } from '@/types/legal';
import type { Document } from '@/types/database';
import { EmptyState } from '@/components/shared/empty-state';
import { Panel, Button, Skeleton } from '@/components/shared/ui';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDate } from '@/lib/utils';

type ApiDocument = Partial<Document> & Record<string, unknown>;

function value(document: ApiDocument, camel: keyof Document, snake: string) {
    return document[snake] ?? document[camel];
}

function fileSize(bytes: unknown) {
    const size = Number(bytes ?? 0);
    if (!size) return 'Size unavailable';
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function sha256(file: File) {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function EvidenceVault({
    caseId,
    documents,
    loading,
    onChanged,
}: {
    caseId: string;
    documents: Document[];
    loading: boolean;
    onChanged: () => void;
}) {
    const fileInput = useRef<HTMLInputElement>(null);
    const [category, setCategory] = useState<DocumentCategory>('other');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [actionId, setActionId] = useState('');

    async function upload() {
        if (!selectedFile) return;
        setBusy(true); setError(''); setMessage('');
        try {
            const hash = await sha256(selectedFile);
            const form = new FormData();
            form.append('file', selectedFile);
            form.append('caseId', caseId);
            form.append('documentCategory', category);
            form.append('clientHash', hash);
            const response = await fetch('/api/documents', { method: 'POST', body: form });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error?.message ?? 'Unable to upload document');
            setSelectedFile(null);
            if (fileInput.current) fileInput.current.value = '';
            setMessage(body.data?.duplicate ? 'This file is already attached to this case.' : 'Evidence uploaded. OCR processing will appear here when ready.');
            onChanged();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to upload document');
        } finally {
            setBusy(false);
        }
    }

    async function remove(documentId: string) {
        if (!window.confirm('Remove this document from the case?')) return;
        setActionId(documentId); setError('');
        try {
            const response = await fetch(`/api/documents/${documentId}`, { method: 'DELETE' });
            const body = await response.json().catch(() => null);
            if (!response.ok) throw new Error(body?.error?.message ?? 'Unable to remove document');
            onChanged();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to remove document');
        } finally {
            setActionId('');
        }
    }

    async function retry(documentId: string) {
        setActionId(documentId); setError('');
        try {
            const response = await fetch(`/api/documents/${documentId}/reprocess`, { method: 'POST' });
            const body = await response.json().catch(() => null);
            if (!response.ok) throw new Error(body?.error?.message ?? 'Unable to retry document processing');
            setMessage('Document processing completed.');
            onChanged();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to retry document processing');
        } finally {
            setActionId('');
        }
    }

    async function removeDuplicates() {
        const sorted = [...documents].sort((a, b) => String(value(a as ApiDocument, 'createdAt', 'created_at') ?? '').localeCompare(String(value(b as ApiDocument, 'createdAt', 'created_at') ?? '')));
        const seen = new Set<string>();
        const duplicateIds = sorted.reduce<string[]>((ids, document) => {
            const hash = String(value(document as ApiDocument, 'clientHash', 'client_hash') ?? '');
            if (!hash) return ids;
            if (seen.has(hash)) ids.push(String(document.id)); else seen.add(hash);
            return ids;
        }, []);
        if (!duplicateIds.length || !window.confirm(`Remove ${duplicateIds.length} duplicate document${duplicateIds.length === 1 ? '' : 's'}?`)) return;
        setActionId('duplicates'); setError('');
        try {
            for (const documentId of duplicateIds) {
                const response = await fetch(`/api/documents/${documentId}`, { method: 'DELETE' });
                const body = await response.json().catch(() => null);
                if (!response.ok) throw new Error(body?.error?.message ?? 'Unable to remove duplicate documents');
            }
            setMessage(`Removed ${duplicateIds.length} duplicate document${duplicateIds.length === 1 ? '' : 's'}.`);
            onChanged();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to remove duplicate documents');
        } finally {
            setActionId('');
        }
    }

    async function download(documentId: string) {
        const response = await fetch(`/api/documents/${documentId}`);
        const body = await response.json();
        if (response.ok && body.data?.downloadUrl) window.open(body.data.downloadUrl, '_blank', 'noopener,noreferrer');
        else setError(body.error?.message ?? 'Unable to create a download link');
    }

    return (
        <div className="space-y-6">
            <Panel title="Add evidence" description="Upload medical records, correspondence and expert material. Files are encrypted in storage and hashed before ingestion.">
                <div className="grid gap-4 p-5 lg:grid-cols-[1fr_220px_auto] lg:items-end">
                    <div><label className="mb-1.5 block text-sm font-medium text-navy" htmlFor="evidence-file">Select a file</label><button type="button" onClick={() => fileInput.current?.click()} className="flex h-11 w-full items-center gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 text-left text-sm transition hover:border-gold hover:bg-gold-50/30"><UploadCloud className="h-4 w-4 shrink-0 text-gold-600" /><span className="truncate text-slate-600">{selectedFile ? selectedFile.name : 'PDF, PNG, JPEG or WebP up to 25 MB'}</span></button><input ref={fileInput} id="evidence-file" type="file" accept=".pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} /></div>
                    <label className="block text-sm font-medium text-navy">Category<select value={category} onChange={(event) => setCategory(event.target.value as DocumentCategory)} className="mt-1.5 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20">{DOCUMENT_CATEGORIES.map((item) => <option key={item} value={item}>{DOCUMENT_CATEGORY_LABELS[item]}</option>)}</select></label>
                    <Button onClick={() => void upload()} disabled={!selectedFile} loading={busy} className="w-full lg:w-auto"><Plus className="h-4 w-4" />Upload evidence</Button>
                </div>
                {busy && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-5 space-y-3">
                        <div className="flex items-center gap-3">
                            <Loader2 className="h-4 w-4 animate-spin text-gold-600" />
                            <p className="text-sm font-medium text-navy">
                                Ingesting document & performing OCR…
                            </p>
                        </div>
                        <p className="text-xs text-slate-500">
                            Large PDFs can take up to 60 seconds to process. Please wait while text and embeddings are generated.
                        </p>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    </div>
                )}
                {error && <p className="border-t border-crimson-100 bg-crimson-50 px-5 py-3 text-sm text-crimson">{error}</p>}
                {message && <p className="flex items-center gap-2 border-t border-emerald-100 bg-emerald-50 px-5 py-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{message}</p>}
            </Panel>
            <Panel title="Case evidence" description={`${documents.length} ${documents.length === 1 ? 'document' : 'documents'} linked to this matter`}>
                {documents.length > 1 && <div className="flex justify-end border-b border-slate-100 px-5 py-3"><Button type="button" variant="secondary" onClick={() => void removeDuplicates()} disabled={actionId !== ''} loading={actionId === 'duplicates'}><Trash2 className="h-4 w-4" />Delete duplicates</Button></div>}
                {loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading evidence…</div> : documents.length === 0 ? <EmptyState title="No evidence uploaded" description="Add the first medical record to start building an evidence trail for this matter." /> : <div className="divide-y divide-slate-100">{documents.map((document) => { const item = document as ApiDocument; const id = String(item.id); const fileName = String(value(item, 'fileName', 'file_name') ?? 'Untitled document'); const documentCategory = String(value(item, 'category', 'category') ?? 'other').replace(/_/g, ' '); const createdAt = value(item, 'createdAt', 'created_at'); const ocrStatus = String(value(item, 'ocrStatus', 'ocr_status') ?? 'pending').toLowerCase(); const embeddingStatus = String(value(item, 'embeddingStatus', 'embedding_status') ?? 'pending').toLowerCase(); const failed = ocrStatus === 'failed' || embeddingStatus === 'failed'; const processingStatus = failed ? 'failed' : ocrStatus; const processingError = String(value(item, 'ocrError', 'ocr_error') ?? ''); const disabled = actionId !== ''; return <div key={id} className="flex flex-wrap items-center gap-4 px-5 py-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-crimson-50 text-crimson"><FileText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-navy">{fileName}</p><p className="mt-1 text-xs capitalize text-slate-500">{documentCategory} · {fileSize(value(item, 'fileSize', 'file_size'))}{createdAt ? ` · ${formatDate(String(createdAt))}` : ''}</p>{processingError && <p className="mt-1 truncate text-xs text-crimson" title={processingError}>AI processing: {processingError}</p>}</div><StatusBadge status={processingStatus} label={failed ? 'AI processing failed' : undefined} /><div className="flex items-center gap-1"><button type="button" onClick={() => void download(id)} disabled={disabled} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-navy disabled:opacity-50" aria-label={`Download ${fileName}`}><Download className="h-4 w-4" /></button>{failed && <button type="button" onClick={() => void retry(id)} disabled={disabled} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-navy disabled:opacity-50" aria-label={`Retry processing ${fileName}`}><RefreshCw className={`h-4 w-4 ${actionId === id ? 'animate-spin' : ''}`} /></button>}<button type="button" onClick={() => void remove(id)} disabled={disabled} className="rounded-md p-2 text-slate-400 hover:bg-crimson-50 hover:text-crimson disabled:opacity-50" aria-label={`Remove ${fileName}`}><Trash2 className="h-4 w-4" /></button></div></div>; })}</div>}
            </Panel>
            <div className="flex items-start gap-3 rounded-lg border border-gold-100 bg-gold-50/60 p-4 text-xs leading-5 text-gold-600"><FileArchive className="mt-0.5 h-4 w-4 shrink-0" /><p>OCR and retrieval are assistive workflows. Review extracted text against the original record before relying on it in a pleading or advice.</p></div>
        </div>
    );
}
