'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { lemmaClient } from '@/lib/lemma';
import { useLemma } from '@/components/LemmaProvider';
import { ArrowLeft, AlertTriangle, CheckCircle, Shield, FileText, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

function parseJsonSafe(val: any, fallback: any = []) {
  if (!val) return fallback;
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

function RiskBadge({ level }: { level: string }) {
  const cls: Record<string, string> = {
    SAFE: 'risk-safe', LOW: 'risk-low', MEDIUM: 'risk-medium', HIGH: 'risk-high', CRITICAL: 'risk-critical',
  };
  return (
    <span className={cls[level] ?? 'risk-medium'} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center' }}>
      {level}
    </span>
  );
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const dash = (pct / 100) * circ;
  const color = score >= 70 ? '#dc2626' : score >= 50 ? '#ea580c' : score >= 30 ? '#d97706' : '#16a34a';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={circ - dash} strokeLinecap="round" />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: size * 0.22, fontWeight: 800, fill: color, transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}>
        {score}
      </text>
    </svg>
  );
}

function ClauseCard({ clause, index }: { clause: any; index: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const cls: Record<string, string> = { SAFE: 'risk-safe', LOW: 'risk-low', MEDIUM: 'risk-medium', HIGH: 'risk-high', CRITICAL: 'risk-critical' };
  const riskCls = cls[clause.risk_level] ?? 'risk-medium';

  return (
    <div className="glass" style={{ overflow: 'hidden', transition: 'all 0.2s' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
        background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', textAlign: 'left',
      }}>
        <span className={riskCls} style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
          {clause.risk_level ?? 'MEDIUM'}
        </span>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{clause.clause_type}</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', marginRight: 6 }}>Score: {clause.risk_score ?? '—'}/10</span>
        {open ? <ChevronUp size={14} color="var(--text-dim)" /> : <ChevronDown size={14} color="var(--text-dim)" />}
      </button>

      {open && (
        <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border)' }}>
          {clause.clause_text && (
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginTop: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Clause Text</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, fontStyle: 'italic' }}>{clause.clause_text}</p>
            </div>
          )}
          {clause.risk_reason && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Why It's Risky</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{clause.risk_reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NegotiationCard({ neg }: { neg: any }) {
  const [copied, setCopied] = useState(false);
  const priority = neg.priority === 'MUST_FIX';

  const copy = () => {
    navigator.clipboard.writeText(neg.counter_language ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass" style={{ padding: 20, borderLeft: `3px solid ${priority ? '#ef4444' : '#f59e0b'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{neg.clause_type}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
          background: priority ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
          color: priority ? '#ef4444' : '#f59e0b',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>{priority ? 'Must Fix' : 'Should Fix'}</span>
      </div>
      {neg.negotiation_tip && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>{neg.negotiation_tip}</p>}
      {neg.counter_language && (
        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Suggested Counter</p>
            <button onClick={copy} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copied ? '#22c55e' : 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, fontStyle: 'italic' }}>{neg.counter_language}</p>
        </div>
      )}
    </div>
  );
}

export default function AnalysisPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const analysisId = searchParams.get('aid');
  const [document, setDocument] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'clauses' | 'negotiate'>('overview');

  useEffect(() => {
    if (!id) return;
    fetchData();
  }, [id]);

  const fetchData = async (attempt = 0) => {
    try {
      const doc = await lemmaClient.records.get('documents', id as string);
      setDocument(doc);

      let found: any = null;

      if (analysisId) {
        // Direct fetch if we have the analysis ID (passed from upload redirect)
        try {
          found = await lemmaClient.records.get('analyses', analysisId);
          console.log('[Analysis] Direct fetch by aid:', found?.id);
        } catch (e) {
          console.warn('[Analysis] Direct fetch failed, falling back to list');
        }
      }

      if (!found) {
        // Fallback: scan list
        const analysesRes = await lemmaClient.records.list('analyses');
        const records = analysesRes?.items ?? [];
        console.log('[Analysis] list returned', records.length, 'records');
        found = records.find((a: any) => a.document_id === id);
      }

      if (found) {
        setAnalysis(found);
      } else if (attempt < 8) {
        // Retry up to 8x with 2s gap (16s total)
        setTimeout(() => fetchData(attempt + 1), 2000);
        return;
      }
    } catch (e) {
      console.error('Analysis fetch error:', e);
    } finally {
      setLoading(false);
    }
  };


  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
      <div className="spin" style={{ width: 28, height: 28, border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: '50%', marginRight: 12 }} />
      Loading analysis...
    </div>
  );

  if (!document) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
      <p style={{ color: 'var(--text-muted)' }}>Document not found.</p>
      <Link href="/dashboard" className="btn btn-ghost">← Back to Dashboard</Link>
    </div>
  );

  const clauses: any[] = parseJsonSafe(analysis?.clauses, []);
  const redFlags: string[] = parseJsonSafe(analysis?.red_flags, []);
  const negotiations: any[] = parseJsonSafe(analysis?.recommendations, []);
  const missingClauses: any[] = parseJsonSafe(analysis?.missing_clauses, []);
  const nextSteps: string[] = parseJsonSafe(analysis?.next_steps, []);

  const riskScore = analysis?.risk_score ?? 0;
  const riskLevel = analysis?.risk_level ?? 'MEDIUM';
  const rec = analysis?.overall_recommendation ?? 'NEGOTIATE_THEN_SIGN';

  const recColor = rec === 'SIGN_AS_IS' ? '#22c55e' : rec === 'DO_NOT_SIGN' ? '#ef4444' : '#f59e0b';
  const recLabel = rec === 'SIGN_AS_IS' ? '✓ Safe to Sign' : rec === 'DO_NOT_SIGN' ? '✕ Do Not Sign' : '⚠ Negotiate First';

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 28 }}>
        <Link href="/dashboard" style={{ color: 'var(--text-muted)', marginTop: 4, textDecoration: 'none' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{document.title || document.file_name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{document.file_type}</span>
            {document.page_count > 0 && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>· {document.page_count} pages</span>}
            {analysis?.doc_type && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>· {analysis.doc_type}</span>}
          </div>
        </div>
        {analysis && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
            <div style={{ textAlign: 'center' }}>
              <ScoreRing score={riskScore} size={72} />
              <p style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, textAlign: 'center' }}>RISK SCORE</p>
            </div>
            <div>
              <RiskBadge level={riskLevel} />
              <div style={{ marginTop: 8, padding: '5px 10px', borderRadius: 8, background: `${recColor}15`, border: `1px solid ${recColor}30` }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: recColor }}>{recLabel}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {!analysis ? (
        <div className="glass" style={{ padding: 48, textAlign: 'center' }}>
          <div className="spin" style={{ width: 28, height: 28, border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: '50%', margin: '0 auto 14px' }} />
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Loading analysis results...</p>
          <button className="btn btn-ghost" onClick={() => { setLoading(true); fetchData(); }}>Retry</button>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
            {(['overview', 'clauses', 'negotiate'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: '10px 18px', background: 'transparent', border: 'none',
                color: activeTab === tab ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: activeTab === tab ? 700 : 500, fontSize: 14,
                cursor: 'pointer', position: 'relative', textTransform: 'capitalize',
              }}>
                {tab === 'overview' ? 'Overview' : tab === 'clauses' ? `Clauses (${clauses.length})` : `Negotiate (${negotiations.length})`}
                {activeTab === tab && <span style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: 'var(--accent)', borderRadius: 99 }} />}
              </button>
            ))}
          </div>

          {/* Tab: Overview */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="fade-in">
              {/* Executive summary */}
              {analysis.summary && (
                <div className="glass" style={{ padding: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', marginBottom: 10 }}>Executive Summary</p>
                  <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>{analysis.summary}</p>
                </div>
              )}

              {/* Red flags */}
              {redFlags.length > 0 && (
                <div className="glass" style={{ padding: 20, borderLeft: '3px solid #ef4444' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#ef4444', marginBottom: 12 }}>
                    🚩 Top Red Flags
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {redFlags.map((flag, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <AlertTriangle size={13} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{flag}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Parties */}
              {parseJsonSafe(analysis.parties, []).length > 0 && (
                <div className="glass" style={{ padding: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>Parties</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {parseJsonSafe(analysis.parties, []).map((p: string, i: number) => (
                      <span key={i} style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 500 }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing clauses */}
              {missingClauses.length > 0 && (
                <div className="glass" style={{ padding: 20, borderLeft: '3px solid #f59e0b' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#f59e0b', marginBottom: 12 }}>Missing Clauses</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {missingClauses.map((mc: any, i: number) => (
                      <div key={i}>
                        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{mc.clause_type ?? mc}</p>
                        {mc.risk_reason && <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{mc.risk_reason}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next steps */}
              {nextSteps.length > 0 && (
                <div className="glass" style={{ padding: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', marginBottom: 12 }}>Recommended Next Steps</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {nextSteps.map((step, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Clauses */}
          {activeTab === 'clauses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} className="fade-in">
              {clauses.length === 0
                ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No clauses found.</p>
                : clauses.map((c, i) => <ClauseCard key={i} clause={c} index={i} />)
              }
            </div>
          )}

          {/* Tab: Negotiate */}
          {activeTab === 'negotiate' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="fade-in">
              {negotiations.length === 0
                ? (
                  <div className="glass" style={{ padding: 40, textAlign: 'center' }}>
                    <CheckCircle size={36} color="#22c55e" style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>No critical issues found</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>This contract appears balanced with no high-risk clauses requiring negotiation.</p>
                  </div>
                )
                : negotiations.map((neg, i) => <NegotiationCard key={i} neg={neg} />)
              }
            </div>
          )}
        </>
      )}
    </div>
  );
}
