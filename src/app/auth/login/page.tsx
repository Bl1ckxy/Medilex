'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
    const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
    const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
    useEffect(() => {
        const reason = new URLSearchParams(window.location.search).get('error');
        if (reason === 'account_suspended') setError('This account has been suspended. Contact your firm administrator to regain access.');
    }, []);
    async function submit(event: FormEvent) {
        event.preventDefault(); setBusy(true); setError('');
        const { error } = await createSupabaseBrowserClient().auth.signInWithPassword({ email, password });
        if (error) { setError(error.message); setBusy(false); return; }
        const requestedPath = new URLSearchParams(window.location.search).get('returnTo');
        const destination = requestedPath?.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : '/dashboard';
        window.location.assign(destination);
    }
    return <main className="mx-auto flex min-h-screen max-w-md items-center px-6"><form onSubmit={submit} className="w-full space-y-5 rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="font-serif text-3xl font-semibold">Sign in to MediLex</h1>
        <label className="block text-sm">Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
        <label className="block text-sm">Password<input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
        {error && <p className="text-sm text-destructive">{error}</p>}<button disabled={busy} className="w-full rounded bg-primary p-2 text-primary-foreground">{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="text-sm">New to MediLex? <Link className="underline" href="/auth/signup">Create an account</Link></p>
    </form></main>;
}
