// ✓ FILE COMPLETE — app-shell.tsx
'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, BriefcaseBusiness, ChevronDown, FileText, Gavel, LayoutDashboard, Menu, Scale, Search, Settings, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navigation = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/cases', label: 'Cases', icon: BriefcaseBusiness },
    { href: '/dashboard/evidence', label: 'Evidence vault', icon: FileText },
    { href: '/dashboard/odr', label: 'ODR & filings', icon: Gavel },
    { href: '/dashboard/legal', label: 'Legal research', icon: Scale },
];

export function AppShell({
    children,
    userName,
    userEmail,
}: {
    children: ReactNode;
    userName: string;
    userEmail: string;
}) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const initials = userName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

    return (
        <div className="min-h-screen bg-[#f7f8fb]">
            <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-navy-700 bg-navy text-white transition-transform lg:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
                <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
                    <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
                        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-gold font-serif text-lg font-bold text-navy">M</span>
                        <span><span className="block font-serif text-lg font-semibold tracking-wide">Medilex</span><span className="block text-[10px] uppercase tracking-[0.2em] text-slate-200">Counsel workspace</span></span>
                    </Link>
                    <button className="rounded p-1 text-slate-200 hover:bg-white/10 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
                </div>
                <div className="px-4 pt-7">
                    <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Workspace</p>
                    <nav className="space-y-1">
                        {navigation.map(({ href, label, icon: Icon }) => {
                            const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
                            return <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={cn('flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors', active ? 'bg-white/10 font-semibold text-white' : 'text-slate-200 hover:bg-white/5 hover:text-white')}><Icon className={cn('h-4 w-4', active && 'text-gold')} />{label}</Link>;
                        })}
                    </nav>
                </div>
                <div className="mt-auto border-t border-white/10 p-4">
                    <Link href="/dashboard/settings" onClick={() => setMobileOpen(false)} className={cn('flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-200 hover:bg-white/5 hover:text-white', pathname.startsWith('/dashboard/settings') && 'bg-white/10 text-white')}><Settings className="h-4 w-4" />Settings</Link>
                    <div className="mt-4 flex items-center gap-3 rounded-md bg-white/5 p-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold text-xs font-bold text-navy">{initials || 'ML'}</div>
                        <div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{userName}</p><p className="truncate text-[11px] text-slate-300">{userEmail}</p></div>
                    </div>
                </div>
            </aside>
            {mobileOpen && <button className="fixed inset-0 z-30 bg-navy/40 lg:hidden" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
            <div className="lg:pl-64">
                <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-8">
                    <div className="flex items-center gap-3">
                        <button className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
                        <div className="relative hidden sm:block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="h-9 w-64 rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-gold" placeholder="Search cases, evidence..." aria-label="Search workspace" /></div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                        <button className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications"><Bell className="h-5 w-5" /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-crimson" /></button>
                        <div className="hidden h-6 w-px bg-slate-200 sm:block" />
                        <Link href="/dashboard/settings" className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">{initials || 'ML'}</div><ChevronDown className="h-4 w-4 text-slate-400" /></Link>
                    </div>
                </header>
                <main className="mx-auto min-h-[calc(100vh-5rem)] max-w-[1440px] px-4 py-8 sm:px-8">{children}</main>
            </div>
            <div className="sr-only"><ShieldCheck aria-hidden="true" /></div>
        </div>
    );
}
