-- ============================================================================
-- MediLex — Legal Corpus (Indian Medical Negligence Law)
-- Run this in the Supabase SQL Editor AFTER schema.sql / rls_policies.sql
-- Idempotent: safe to re-run.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Extensions
-- --------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------------
-- Table: legal_chunks
--
-- Curated Indian medical-negligence authorities: statutes, landmark Supreme
-- Court judgments, legal doctrines, professional-conduct guidelines and
-- consumer-commission practice notes. Each row is a single self-contained
-- legal proposition that can stand alone inside a prompt.
--
-- This table is SHARED REFERENCE DATA, not tenant data. There is no firm_id
-- and no case_id. Every authenticated firm member reads the same corpus.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legal_chunks (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citation          TEXT NOT NULL UNIQUE,
    title             TEXT NOT NULL,
    source_type       TEXT NOT NULL CHECK (
                          source_type IN ('statute', 'case', 'doctrine', 'guideline', 'practice')
                      ),
    court             TEXT,
    year              INTEGER,
    tags              TEXT[] NOT NULL DEFAULT '{}',
    negligence_types  TEXT[] NOT NULL DEFAULT '{}',
    content           TEXT NOT NULL,
    token_count       INTEGER,
    embedding         vector(768),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.legal_chunks IS
    'Curated Indian medical-negligence legal corpus with pgvector embeddings. Shared reference law; read-only for all authenticated users.';

-- --------------------------------------------------------------------------
-- Indexes
-- --------------------------------------------------------------------------

-- HNSW index for approximate nearest-neighbour cosine search.
CREATE INDEX IF NOT EXISTS legal_chunks_embedding_idx
    ON public.legal_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- GIN index so tag filters inside match_legal_chunks() stay cheap.
CREATE INDEX IF NOT EXISTS legal_chunks_tags_idx
    ON public.legal_chunks USING GIN (tags);

-- btree on source_type for filtering statutes vs judgments vs doctrine.
CREATE INDEX IF NOT EXISTS legal_chunks_source_type_idx
    ON public.legal_chunks (source_type);

-- --------------------------------------------------------------------------
-- Row Level Security
--
-- DELIBERATELY DIFFERENT FROM document_chunks.
--
-- supabase/rls_policies.sql sets document_chunks to FOR ALL USING (FALSE),
-- i.e. deny-all, because a firm's case evidence must be reachable only
-- through a case-access check.
--
-- The legal corpus is not tenant data. It is published law. A case access
-- check would be meaningless here, and denying reads would break every
-- authenticated user's ability to receive legal grounding. So:
--
--   SELECT  -> allowed for any authenticated user
--   INSERT/UPDATE/DELETE -> NO policy exists, so anon and authenticated are
--                            both denied. Only the service-role key can write,
--                            and writes happen exclusively via
--                            scripts/seed-legal-corpus.mjs.
-- --------------------------------------------------------------------------
ALTER TABLE public.legal_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_chunks_select_authenticated ON public.legal_chunks;
CREATE POLICY legal_chunks_select_authenticated
    ON public.legal_chunks
    FOR SELECT
    TO authenticated
    USING (true);

-- --------------------------------------------------------------------------
-- Function: match_legal_chunks
--
-- Cosine-distance nearest-neighbour search over the corpus.
--
-- SECURITY DEFINER IS DELIBERATE. supabase/functions.sql defines match_chunks
-- WITHOUT security definer, while rls_policies.sql puts document_chunks
-- behind a deny-all policy. That combination means match_chunks can only ever
-- succeed when called with the service-role key -- a latent bug. This function
-- is declared SECURITY DEFINER with a pinned search_path so an authenticated
-- caller's RLS context is not applied, matching the behaviour the is_firm_admin
-- / current_user_id / has_case_access helpers in rls_policies.sql rely on.
--
-- Parameters
--   query_embedding  768-dim vector from the same embedding model used at seed time
--   match_count      number of rows to return (clamped to 1..25)
--   match_tags       optional tag filter (overlap semantics)
--   match_type       optional source_type filter
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_legal_chunks(
    query_embedding vector(768),
    match_count     INTEGER DEFAULT 8,
    match_tags      TEXT[]   DEFAULT NULL,
    match_type      TEXT     DEFAULT NULL
)
RETURNS TABLE (
    id            UUID,
    citation      TEXT,
    title         TEXT,
    source_type   TEXT,
    court         TEXT,
    year          INTEGER,
    tags          TEXT[],
    content       TEXT,
    similarity    FLOAT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        lc.id,
        lc.citation,
        lc.title,
        lc.source_type,
        lc.court,
        lc.year,
        lc.tags,
        lc.content,
        (lc.embedding <=> query_embedding)::FLOAT AS similarity
    FROM public.legal_chunks lc
    WHERE lc.embedding IS NOT NULL
      AND (match_tags  IS NULL OR lc.tags && match_tags)
      AND (match_type  IS NULL OR lc.source_type = match_type)
    ORDER BY lc.embedding <=> query_embedding
    LIMIT greatest(1, least(match_count, 25));
$$;

REVOKE ALL ON FUNCTION public.match_legal_chunks(VECTOR, INTEGER, TEXT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_legal_chunks(VECTOR, INTEGER, TEXT[], TEXT)
    TO authenticated, service_role;

-- --------------------------------------------------------------------------
-- Function: get_legal_corpus_stats()
-- Small helper so the eval harness and the UI can report corpus coverage
-- without shipping a query for it.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_legal_corpus_stats()
RETURNS TABLE (
    total            INTEGER,
    embedded         INTEGER,
    statutes         INTEGER,
    cases            INTEGER,
    doctrines        INTEGER,
    guidelines       INTEGER,
    practice_notes   INTEGER
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        count(*)::INTEGER                                                   AS total,
        count(*) FILTER (WHERE embedding IS NOT NULL)::INTEGER              AS embedded,
        count(*) FILTER (WHERE source_type = 'statute')::INTEGER           AS statutes,
        count(*) FILTER (WHERE source_type = 'case')::INTEGER              AS cases,
        count(*) FILTER (WHERE source_type = 'doctrine')::INTEGER          AS doctrines,
        count(*) FILTER (WHERE source_type = 'guideline')::INTEGER         AS guidelines,
        count(*) FILTER (WHERE source_type = 'practice')::INTEGER          AS practice_notes
    FROM public.legal_chunks;
$$;

REVOKE ALL ON FUNCTION public.get_legal_corpus_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_legal_corpus_stats() TO authenticated, service_role;

-- --------------------------------------------------------------------------
-- Post-deploy verification
--
-- Run these after applying the SQL:
--
--   SELECT count(*) FROM legal_chunks;
--       -> expect 0 before seeding
--
--   SELECT proname FROM pg_proc WHERE proname IN
--       ('match_legal_chunks', 'get_legal_corpus_stats');
--       -> expect 2 rows
--
--   SELECT * FROM get_legal_corpus_stats();
--       -> expect total 62, embedded 62 after seeding
--
--   SELECT citation, round((embedding <=> embedding)::numeric, 4) AS sim
--       FROM legal_chunks ORDER BY embedding <=> (
--           SELECT embedding FROM legal_chunks LIMIT 1) LIMIT 5;
--       -> smoke-test that the HNSW index is being used
-- ============================================================================