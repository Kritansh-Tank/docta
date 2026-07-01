'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLemma } from '@/components/LemmaProvider';
import { lemmaClient } from '@/lib/lemma';
import { Shield, Building2, Globe } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const { setOrg } = useLemma();
  const [orgName, setOrgName] = useState('');
  const [domain, setDomain] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!orgName.trim()) { setError('Organization name is required'); return; }

    setSaving(true);
    setError('');
    try {
      const record = await lemmaClient.records.create('organizations', {
        name: orgName.trim(),
        domain: domain.trim() || '',
        plan: 'free',
        owner_user_id: '',
      });
      setOrg({ id: record?.id, name: orgName.trim() });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create organization');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 40 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={22} color="#fff" />
          </div>
          <span style={{ fontSize: 24, fontWeight: 800 }}>Docta</span>
        </div>

        <div className="glass" style={{ padding: 36 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, textAlign: 'center' }}>Set Up Your Workspace</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginBottom: 28 }}>
            Create your organization to start analyzing contracts as a team.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Building2 size={13} /> Organization Name *
              </label>
              <input
                className="input"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="Acme Corp"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Globe size={13} /> Company Domain <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                className="input"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="acmecorp.com"
              />
            </div>

            {error && <p style={{ fontSize: 13, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>}

            <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !orgName.trim()} style={{ width: '100%', justifyContent: 'center', marginTop: 4, padding: '12px 20px' }}>
              {saving ? 'Creating...' : 'Create Workspace →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
