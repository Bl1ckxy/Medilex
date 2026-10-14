/**
 * MediLex — seed the legal corpus into Supabase.
 *
 * Reads data/legal/corpus.jsonl, validates it, embeds each chunk with Gemini
 * gemini-embedding-001 (768 dims via outputDimensionality, matching
 * legal_chunks.embedding vector(768)), and upserts into public.legal_chunks
 * using the service-role key. Writes are
 * service-role only by design: legal_corpus.sql grants SELECT to authenticated
 * and deliberately creates no INSERT/UPDATE/DELETE policy.
 *
 * Usage:
 *   node scripts/seed-legal-corpus.mjs                     # against .env.local
 *   node scripts/seed-legal-corpus.mjs --env production    # against .env.production
 *   node scripts/seed-legal-corpus.mjs --resume            # skip citations already present
 *   node scripts/seed-legal-corpus.mjs --dry-run           # validate only, no network
 *   node scripts/seed-legal-corpus.mjs --batch 5           # smaller batches on rate limits
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { config as loadEnv } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const EMBEDDING_MODELS = ['gemini-embedding-001', 'gemini-embedding-2'];
const EXPECTED_DIMS = 768;
const REQUIRED_FIELDS = [
    'id',
    'citation',
    'title',
    'source_type',
    'content',
    'tags',
    'negligence_types',
];

const VALID_SOURCE_TYPES = ['statute', 'case', 'doctrine', 'guideline', 'practice'];
const VALID_NEGLIGENCE_TYPES = [
    'misdiagnosis',
    'surgical_error',
    'delayed_treatment',
    'medication_error',
    'birth_injury',
    'anesthesia_error',
    'informed_consent_failure',
    'hospital_infection',
    'wrong_site_surgery',
    'equipment_failure',
    'other',
    'all',
];

function parseArgs(argv) {
    const args = { env: 'local', resume: false, dryRun: false, batch: 10 };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--env') args.env = argv[++i];
        else if (arg === '--resume') args.resume = true;
        else if (arg === '--dry-run') args.dryRun = true;
        else if (arg === '--batch') args.batch = Number(argv[++i]);
    }
    return args;
}

function loadEnvironment(target) {
    const file = target === 'production' ? '.env.production' : '.env.local';
    loadEnv({ path: resolve(process.cwd(), file) });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const aiKey = process.env.GOOGLE_AI_API_KEY;

    const missing = [];
    if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!aiKey) missing.push('GOOGLE_AI_API_KEY');
    if (missing.length) {
        console.error(`Missing credentials in ${file}: ${missing.join(', ')}`);
        process.exit(1);
    }
    return { url, serviceKey, aiKey, file };
}

async function readCorpus() {
    const path = resolve(process.cwd(), 'data/legal/corpus.jsonl');
    const raw = await readFile(path, 'utf8');
    const lines = raw.trim().split('\n');

    const errors = [];
    const seenIds = new Set();
    const seenCitations = new Map();
    const chunks = [];

    lines.forEach((line, index) => {
        const lineNo = index + 1;
        let parsed;
        try {
            parsed = JSON.parse(line);
        } catch {
            errors.push(`line ${lineNo}: not valid JSON`);
            return;
        }
        for (const field of REQUIRED_FIELDS) {
            if (!parsed[field]) errors.push(`line ${lineNo}: missing required field "${field}"`);
        }
        if (!VALID_SOURCE_TYPES.includes(parsed.source_type)) {
            errors.push(`line ${lineNo}: invalid source_type "${parsed.source_type}"`);
        }
        (parsed.negligence_types || []).forEach((type) => {
            if (!VALID_NEGLIGENCE_TYPES.includes(type)) {
                errors.push(`line ${lineNo}: invalid negligence_type "${type}"`);
            }
        });
        if (seenIds.has(parsed.id)) errors.push(`line ${lineNo}: duplicate id "${parsed.id}"`);
        seenIds.add(parsed.id);
        seenCitations.set(parsed.citation, (seenCitations.get(parsed.citation) || 0) + 1);
        chunks.push(parsed);
    });

    seenCitations.forEach((count, citation) => {
        if (count > 1) errors.push(`duplicate citation (${count}x): "${citation}"`);
    });

    if (errors.length) {
        console.error(`Corpus validation failed with ${errors.length} error(s):`);
        errors.forEach((err) => console.error(`  - ${err}`));
        process.exit(1);
    }
    return chunks;
}

async function embedOnce(genai, model, text, attempt = 1) {
    try {
        const response = await genai.models.embedContent({
            model,
            contents: text,
            config: { outputDimensionality: EXPECTED_DIMS },
        });
        const values = response.embeddings?.[0]?.values;
        if (!values || values.length === 0) {
            throw new Error(`${model} returned empty embedding values`);
        }
        if (values.length !== EXPECTED_DIMS) {
            throw new Error(`${model} returned ${values.length} dims, expected ${EXPECTED_DIMS}`);
        }
        return values;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isRateLimit =
            message.includes('429') || message.toLowerCase().includes('resource_exhausted');
        if (isRateLimit && attempt <= 4) {
            const waitMs = 1000 * 2 ** (attempt - 1);
            console.warn(`  rate limited, retrying in ${waitMs}ms (attempt ${attempt})`);
            await new Promise((r) => setTimeout(r, waitMs));
            return embedOnce(genai, model, text, attempt + 1);
        }
        throw error;
    }
}

async function embedWithRetry(genai, text) {
    let lastError;
    for (const model of EMBEDDING_MODELS) {
        try {
            return await embedOnce(genai, model, text);
        } catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : String(error);
            const canTryNext =
                message.includes('404') ||
                message.toLowerCase().includes('not found') ||
                message.includes('400');
            if (!canTryNext) throw error;
            console.warn(`  embedding model unavailable (${model}), trying next`);
        }
    }
    throw lastError instanceof Error
        ? lastError
        : new Error(`All embedding models failed: ${EMBEDDING_MODELS.join(', ')}`);
}

async function existingCitations(supabase) {
    const { data, error } = await supabase.from('legal_chunks').select('citation');
    if (error) {
        throw new Error(
            `Could not read legal_chunks: ${error.message}\n` +
                'Has supabase/legal_corpus.sql been applied in the SQL Editor?',
        );
    }
    return new Set((data || []).map((row) => row.citation));
}

function chunkToRow(chunk, embedding) {
    return {
        citation: chunk.citation,
        title: chunk.title,
        source_type: chunk.source_type,
        court: chunk.court ?? null,
        year: chunk.year ?? null,
        tags: chunk.tags,
        negligence_types: chunk.negligence_types,
        content: chunk.content,
        token_count: Math.round(chunk.content.split(/\s+/).length * 1.35),
        embedding: JSON.stringify(embedding),
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const startedAt = Date.now();

    console.log('MediLex — legal corpus seeder');
    console.log(`  target env : ${args.env} (.env.${args.env})`);
    console.log(`  batch size : ${args.batch}`);
    console.log(`  mode       : ${args.dryRun ? 'dry-run' : args.resume ? 'resume' : 'full'}`);
    console.log('');

    const chunks = await readCorpus();
    console.log(`Validated ${chunks.length} chunks from data/legal/corpus.jsonl`);

    const bySourceType = chunks.reduce((acc, chunk) => {
        acc[chunk.source_type] = (acc[chunk.source_type] || 0) + 1;
        return acc;
    }, {});
    Object.entries(bySourceType)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => console.log(`  ${type.padEnd(10)} ${count}`));
    console.log('');

    if (args.dryRun) {
        console.log('Dry run — nothing written. Corpus is structurally valid.');
        return;
    }

    const { url, serviceKey, aiKey, file } = loadEnvironment(args.env);
    console.log(`Loaded credentials from ${file}`);
    console.log(`Target Supabase: ${new URL(url).host}`);
    console.log('');

    const supabase = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const genai = new GoogleGenAI({ apiKey: aiKey });

    let pending = chunks;
    if (args.resume) {
        const present = await existingCitations(supabase);
        pending = chunks.filter((chunk) => !present.has(chunk.citation));
        console.log(`Resume mode: ${present.size} already seeded, ${pending.length} to process`);
        console.log('');
    }

    if (!pending.length) {
        console.log('Nothing to seed.');
        return;
    }

    let inserted = 0;
    let failed = 0;
    let embeddings = 0;

    for (let offset = 0; offset < pending.length; offset += args.batch) {
        const slice = pending.slice(offset, offset + args.batch);
        const batchNo = Math.floor(offset / args.batch) + 1;
        const totalBatches = Math.ceil(pending.length / args.batch);
        process.stdout.write(`  batch ${batchNo}/${totalBatches} (${slice.length} chunks) ... `);

        const embedded = await Promise.all(
            slice.map((chunk) =>
                embedWithRetry(genai, `${chunk.title}\n\n${chunk.content}`).then((values) => ({
                    chunk,
                    values,
                })),
            ),
        );
        embeddings += embedded.length;

        const { error } = await supabase.from('legal_chunks').upsert(
            embedded.map(({ chunk, values }) => chunkToRow(chunk, values)),
            { onConflict: 'citation' },
        );

        if (error) {
            failed += slice.length;
            console.log(`FAILED — ${error.message}`);
            console.log('  Aborting: the legal_chunks table may not exist yet.');
            console.log(
                '  Apply supabase/legal_corpus.sql in the Supabase SQL Editor, then re-run.',
            );
            process.exit(1);
        }

        inserted += slice.length;
        console.log('ok');
    }

    const { data: stats } = await supabase.rpc('get_legal_corpus_stats');
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

    console.log('');
    console.log('Seed complete');
    console.log(`  processed   : ${inserted}`);
    console.log(`  embedded    : ${embeddings}`);
    console.log(`  failed      : ${failed}`);
    console.log(`  elapsed     : ${elapsed}s`);
    if (stats?.[0]) {
        console.log('');
        console.log('Corpus state in Supabase:');
        console.log(`  total        : ${stats[0].total}`);
        console.log(`  embedded     : ${stats[0].embedded}`);
        console.log(`  statutes     : ${stats[0].statutes}`);
        console.log(`  cases        : ${stats[0].cases}`);
        console.log(`  doctrines    : ${stats[0].doctrines}`);
        console.log(`  guidelines   : ${stats[0].guidelines}`);
        console.log(`  practice     : ${stats[0].practice_notes}`);
    }
    if (failed > 0) console.log(`\n${failed} chunk(s) failed.`);
    if (stats?.[0] && stats[0].embedded !== stats[0].total) {
        console.log('\nWARNING: some rows have a null embedding. Re-run with --resume.');
    }
}

main().catch((error) => {
    console.error('\nSeeding failed:', error instanceof Error ? error.message : error);
    process.exit(1);
});
