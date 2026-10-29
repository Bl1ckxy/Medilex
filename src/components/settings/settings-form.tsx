'use client';

import { useEffect, useState } from 'react';
import { Check, LogOut, Moon, ShieldCheck, UserRound } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/shared/page-header';
import { Panel, Button, TextInput } from '@/components/shared/ui';

export function SettingsForm({ userName, email }: { userName: string; email: string }) {
    const [name, setName] = useState(userName);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [compactMode, setCompactMode] = useState(false);

    useEffect(() => {
        setCompactMode(window.localStorage.getItem('medilex-compact-mode') === 'true');
    }, []);

    async function saveProfile() {
        setSaving(true);
        setError('');
        try {
            const response = await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName: name }),
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error?.message ?? 'Unable to save profile');
            setName(body.data.full_name);
            setSaved(true);
            window.setTimeout(() => setSaved(false), 2500);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to save profile');
        } finally {
            setSaving(false);
        }
    }

    function toggleCompact(value: boolean) {
        setCompactMode(value);
        window.localStorage.setItem('medilex-compact-mode', String(value));
    }

    async function signOut() {
        await createSupabaseBrowserClient().auth.signOut();
        window.location.assign('/auth/login');
    }

    return (
        <div className="space-y-8">
            <PageHeader eyebrow="Workspace preferences" title="Settings" description="Manage your workspace profile, accessibility preferences and account session." />
            <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-6">
                    <Panel title="Profile" description="This information is used across your MediLex workspace.">
                        <div className="space-y-5 p-5">
                            <TextInput label="Display name" value={name} onChange={(event) => setName(event.target.value)} />
                            <TextInput label="Email address" value={email} readOnly className="bg-slate-50 text-slate-500" hint="Email changes are managed by your identity provider." />
                            <div className="flex items-center gap-3">
                                <Button onClick={() => void saveProfile()} loading={saving}>
                                    {saved ? <><Check className="h-4 w-4" />Saved</> : 'Save profile'}
                                </Button>
                                {saved && <span className="text-xs text-emerald-700">Profile saved to your workspace.</span>}
                                {error && <span className="text-xs text-crimson">{error}</span>}
                            </div>
                        </div>
                    </Panel>
                    <Panel title="Preferences" description="Keep the workspace comfortable for long review sessions.">
                        <div className="divide-y divide-slate-100">
                            <label className="flex cursor-pointer items-start justify-between gap-4 p-5">
                                <span className="flex gap-3">
                                    <span className="rounded-md bg-navy-50 p-2 text-navy"><Moon className="h-4 w-4" /></span>
                                    <span>
                                        <span className="block text-sm font-medium text-navy">Compact case lists</span>
                                        <span className="mt-1 block text-xs leading-5 text-slate-500">Reduce row spacing in long evidence and case lists.</span>
                                    </span>
                                </span>
                                <input type="checkbox" checked={compactMode} onChange={(event) => toggleCompact(event.target.checked)} className="mt-1 h-4 w-4 accent-gold" />
                            </label>
                        </div>
                    </Panel>
                </div>
                <div className="space-y-6">
                    <Panel title="Security" description="Your workspace session and access controls.">
                        <div className="space-y-4 p-5">
                            <div className="flex gap-3">
                                <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                                <p className="text-sm leading-6 text-slate-600">Your case data is protected by Supabase authentication and firm-level access controls.</p>
                            </div>
                            <button onClick={() => void signOut()} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:border-crimson-200 hover:bg-crimson-50 hover:text-crimson">
                                <LogOut className="h-4 w-4" />Sign out
                            </button>
                        </div>
                    </Panel>
                    <Panel title="Account">
                        <div className="flex items-center gap-3 p-5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-white"><UserRound className="h-5 w-5" /></div>
                            <div><p className="text-sm font-semibold text-navy">{name || 'Counsel'}</p><p className="mt-1 text-xs text-slate-500">{email}</p></div>
                        </div>
                    </Panel>
                </div>
            </div>
        </div>
    );
}
