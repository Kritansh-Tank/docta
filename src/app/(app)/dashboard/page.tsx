'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLemma } from '@/components/LemmaProvider';
import { lemmaClient } from '@/lib/lemma';
import { Upload, FileText, Shield, AlertTriangle, CheckCircle, Clock, TrendingUp, Plus, Trash2 } from 'lucide-react';

function RiskBadge({ level }: { level: string }) {
  const cls = {
    SAFE: 'risk-safe', LOW: 'risk-low', MEDIUM: 'risk-medium',
    HIGH: 'risk-high', CRITICAL: 'risk-critical',
  }[level] ?? 'risk-medium';
  return (
    <span className={cls} style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {level}
    </span>
  );
}

function RiskScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const dash = (pct / 100) * circ;
  const color = score >= 70 ? '#dc2626' : score >= 50 ? '#ea580c' : score >= 30 ? '#d97706' : '#16a34a';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={4} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={circ - dash} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: size * 0.28, fontWeight: 700, fill: color, transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}>
        {score}
      </text>
    </svg>
  );
}

export default function DashboardPage() {
  const { org, isReady } = useLemma();
  const router = useRouter();
  const [documents, setDocuments] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!org?.id) { router.replace('/onboarding'); return; }
    fetchData();
  }, [isReady, org?.id]);

  const fetchData = async () => {
    try {
      const [docsRes, analysesRes] = await Promise.all([
        lemmaClient.records.list('documents'),
        lemmaClient.records.list('analyses'),
      ]);
      const docs = docsRes?.items ?? [];
      const ans = analysesRes?.items ?? [];
      console.log('[Dashboard] docs:', docs.length, 'analyses:', ans.length);
      setDocuments(docs);
      setAnalyses(ans);
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const getAnalysis = (docId: string) => analyses.find((a: any) => a.document_id === docId);

  const deleteDoc = async (e: React.MouseEvent, docId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this document and its analysis? This cannot be undone.')) return;
    setDeletingId(docId);
    try {
      const analysis = getAnalysis(docId);
      if (analysis?.id) await lemmaClient.records.delete('analyses', analysis.id);
      await lemmaClient.records.delete('documents', docId);
      setDocuments(prev => prev.filter((d: any) => d.id !== docId));
      setAnalyses(prev => prev.filter((a: any) => a.document_id !== docId));
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const totalDocs = documents.length;
  const highRiskDocs = analyses.filter((a: any) => ['HIGH', 'CRITICAL'].includes(a.risk_level)).length;
  const avgScore = analyses.length ? Math.round(analyses.reduce((s: number, a: any) => s + (a.risk_score ?? 0), 0) / analyses.length) : 0;
  const analyzedDocIds = new Set(analyses.map((a: any) => a.document_id));
  const pendingDocs = documents.filter((d: any) => !analyzedDocIds.has(d.id)).length;


  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Contract Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {org?.name ? `${org.name} · ` : ''}{totalDocs} document{totalDocs !== 1 ? 's' : ''} analyzed
          </p>
        </div>
        <Link href="/upload" className="btn btn-primary">
          <Plus size={16} /> Analyze Contract
        </Link>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total Documents', value: totalDocs, icon: FileText, color: '#5b52f0' },
          { label: 'High Risk', value: highRiskDocs, icon: AlertTriangle, color: '#dc2626' },
          { label: 'Avg Risk Score', value: `${avgScore}`, icon: TrendingUp, color: '#d97706' },
          { label: 'Pending Analysis', value: pendingDocs, icon: Clock, color: '#7c6fff' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={15} color={color} />
              </div>
            </div>
            <p style={{ fontSize: 28, fontWeight: 800, color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Documents */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>
          <div className="spin" style={{ width: 28, height: 28, border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: '50%', margin: '0 auto 12px' }} />
          Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <div className="glass" style={{ textAlign: 'center', padding: 64 }}>
          <Shield size={48} color="var(--text-dim)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No contracts yet</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>Upload a PDF or DOCX to get AI-powered risk analysis.</p>
          <Link href="/upload" className="btn btn-primary"><Upload size={15} /> Upload First Contract</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {documents.map((doc: any) => {
            const analysis = getAnalysis(doc.id);
            const isDeleting = deletingId === doc.id;
            return (
              <div key={doc.id} style={{ position: 'relative' }}>
                <Link href={`/analysis/${doc.id}`} style={{ textDecoration: 'none', display: 'block', opacity: isDeleting ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                  <div className="glass glass-hover" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, paddingRight: 56 }}>
                    {/* File icon */}
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={18} color="var(--accent)" />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.title || doc.file_name}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{doc.file_type}</span>
                        {doc.page_count > 0 && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>· {doc.page_count} page{doc.page_count !== 1 ? 's' : ''}</span>}
                        {analysis?.doc_type && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>· {analysis.doc_type}</span>}
                      </div>
                    </div>

                    {/* Risk */}
                    {analysis ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <RiskBadge level={analysis.risk_level} />
                        <RiskScoreRing score={analysis.risk_score ?? 0} size={44} />
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={13} /> No analysis
                      </span>
                    )}
                  </div>
                </Link>

                {/* Delete button — sits outside the Link */}
                <button
                  onClick={(e) => deleteDoc(e, doc.id)}
                  disabled={isDeleting}
                  title="Delete document"
                  style={{
                    position: 'absolute', top: '50%', right: 14, transform: 'translateY(-50%)',
                    width: 32, height: 32, borderRadius: 8,
                    background: 'transparent', border: '1px solid transparent',
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-dim)', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.3)'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; }}
                >
                  {isDeleting
                    ? <div style={{ width: 14, height: 14, border: '2px solid #ef4444', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    : <Trash2 size={14} />
                  }
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
