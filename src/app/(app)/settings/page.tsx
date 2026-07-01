'use client';
import { useState } from 'react';
import { useLemma } from '@/components/LemmaProvider';
import { Shield, Building2, Globe, Users, Key } from 'lucide-react';

export default function SettingsPage() {
  const { org, setOrg, user } = useLemma();
  const [orgName, setOrgName] = useState(org?.name ?? '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (orgName.trim()) {
      setOrg({ ...org, id: org?.id ?? '', name: orgName.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 28 }}>Settings</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Org */}
        <div className="glass" style={{ padding: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={14} /> Organization
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Name</label>
              <input className="input" value={orgName} onChange={e => setOrgName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Workspace ID</label>
              <input className="input" value={org?.id ?? '—'} readOnly style={{ color: 'var(--text-dim)', cursor: 'default' }} />
            </div>
            <button className="btn btn-primary" onClick={handleSave} style={{ alignSelf: 'flex-start' }}>
              {saved ? '✓ Saved' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Team (coming soon) */}
        <div className="glass" style={{ padding: 24, opacity: 0.6 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={14} /> Team Members <span style={{ fontSize: 10, background: 'rgba(108,99,255,0.2)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 99, marginLeft: 4 }}>Coming Soon</span>
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Invite teammates to collaborate on contract analysis.</p>
        </div>

        {/* Powered by */}
        <div className="glass" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Shield size={16} color="var(--accent)" />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600 }}>Powered by Lemma SDK</p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>3-agent AI pipeline · Enterprise-grade security</p>
          </div>
        </div>
      </div>
    </div>
  );
}
