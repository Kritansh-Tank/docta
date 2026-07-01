'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Upload, Settings, Shield } from 'lucide-react';
import { useLemma } from '@/components/LemmaProvider';

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/upload', icon: Upload, label: 'Analyze Contract' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { org } = useLemma();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 236, flexShrink: 0,
        background: '#fff',
        borderRight: '1px solid rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column',
        padding: '24px 14px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, padding: '0 8px' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 2px 8px rgba(91,82,240,0.3)',
          }}>
            <Shield size={17} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>Docta</p>
            <p style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>Contract Intelligence</p>
          </div>
        </div>

        {/* Org badge */}
        {org?.name && (
          <div style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 12px', marginBottom: 18,
          }}>
            <p style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Workspace</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {org.name}
            </p>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1 }}>
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 9, marginBottom: 3,
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                background: active ? 'var(--accent-light)' : 'transparent',
                textDecoration: 'none', fontSize: 14, fontWeight: active ? 600 : 500,
                transition: 'all 0.15s',
                border: active ? '1px solid rgba(91,82,240,0.15)' : '1px solid transparent',
              }}>
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 8 }}>
          <p style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center' }}>Powered by Lemma SDK</p>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
        {children}
      </main>
    </div>
  );
}
