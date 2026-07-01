'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkflowRun } from 'lemma-sdk/react';
import { useLemma } from '@/components/LemmaProvider';
import { lemmaClient } from '@/lib/lemma';
import { Upload, FileText, X, CheckCircle, Loader2, AlertCircle, ChevronRight } from 'lucide-react';

const PIPELINE_STEPS = [
  { id: 'clause_extractor', label: 'Extracting Clauses', description: 'Identifying and categorizing all contract clauses' },
  { id: 'risk_assessor', label: 'Assessing Risk', description: 'Evaluating each clause for risk level and legal exposure' },
  { id: 'negotiation_advisor', label: 'Generating Recommendations', description: 'Drafting negotiation tips and counter-language' },
];

function parseJsonSafe(val: any, fallback: any = null) {
  if (!val) return fallback;
  if (typeof val !== 'string') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

export default function UploadPage() {
  const router = useRouter();
  const { org } = useLemma();
  const workflow = useWorkflowRun({ client: lemmaClient, workflowName: 'analyze-document' });

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'extracting' | 'analyzing' | 'done' | 'error'>('idle');
  const [activeStep, setActiveStep] = useState(-1);
  const [error, setError] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [extractMeta, setExtractMeta] = useState<any>(null);

  const phaseRef = useRef(phase);
  const clientRef = useRef(lemmaClient);
  const fileRef = useRef(file);
  const orgRef = useRef(org);
  const extractedTextRef = useRef(extractedText);
  const extractMetaRef = useRef(extractMeta);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { fileRef.current = file; }, [file]);
  useEffect(() => { orgRef.current = org; }, [org]);
  useEffect(() => { extractedTextRef.current = extractedText; }, [extractedText]);
  useEffect(() => { extractMetaRef.current = extractMeta; }, [extractMeta]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Watch workflow isFinished (fix from HuntBase: start() resolves early)
  useEffect(() => {
    if (!workflow.isFinished || !workflow.finalOutput) return;
    if (phaseRef.current !== 'analyzing') return;

    const ctx = workflow.finalOutput as any;
    console.log('[Docta] finalOutput ctx keys:', Object.keys(ctx));

    // Parse through the 3 agent chain
    const extractorRaw = parseJsonSafe(ctx.clause_extractor?.answer, {});
    const assessorRaw = parseJsonSafe(ctx.risk_assessor?.answer, {});
    const advisorRaw = parseJsonSafe(ctx.negotiation_advisor?.answer, {});

    console.log('[Docta] extractor:', extractorRaw);
    console.log('[Docta] assessor:', assessorRaw);
    console.log('[Docta] advisor:', advisorRaw);

    // Save to DB and navigate
    (async () => {
      const c = clientRef.current;
      const f = fileRef.current;
      const o = orgRef.current;
      const text = extractedTextRef.current;
      const meta = extractMetaRef.current;

      if (!c) return;

      try {
        // 1. Create document record
        const docRecord = await c.records.create('documents', {
          org_id: o?.id ?? '',
          title: f?.name?.replace(/\.[^.]+$/, '') ?? 'Untitled Contract',
          file_name: f?.name ?? '',
          file_type: meta?.fileType ?? 'PDF',
          content_text: text.slice(0, 50000), // cap at 50k chars
          status: 'ANALYZED',
          uploaded_by: '',
          page_count: meta?.pageCount ?? 1,
          word_count: meta?.wordCount ?? 0,
        });
        const docId = docRecord?.id;
        console.log('[Docta] ✅ Document created:', docId);

        // 2. Create analysis record
        const analysisRecord = await c.records.create('analyses', {
          document_id: docId ?? '',
          org_id: o?.id ?? '',
          risk_score: assessorRaw?.overall_risk_score ?? 0,
          risk_level: assessorRaw?.overall_risk_level ?? 'MEDIUM',
          doc_type: extractorRaw?.doc_type ?? '',
          parties: JSON.stringify(extractorRaw?.parties ?? []),
          clauses: JSON.stringify(assessorRaw?.assessed_clauses ?? extractorRaw?.clauses ?? []),
          red_flags: JSON.stringify(assessorRaw?.top_red_flags ?? []),
          missing_clauses: JSON.stringify(assessorRaw?.missing_clause_risks ?? extractorRaw?.missing_clauses ?? []),
          summary: assessorRaw?.executive_summary ?? '',
          recommendations: JSON.stringify(advisorRaw?.negotiations ?? []),
          overall_recommendation: advisorRaw?.overall_recommendation ?? 'NEGOTIATE_THEN_SIGN',
          next_steps: JSON.stringify(advisorRaw?.next_steps ?? []),
        });
        const analysisId = analysisRecord?.id;
        console.log('[Docta] ✅ Analysis created:', analysisId);

        setPhase('done');
        const dest = analysisId
          ? `/analysis/${docId}?aid=${analysisId}`
          : `/analysis/${docId}`;
        setTimeout(() => router.push(dest), 1500);
      } catch (err) {
        console.error('[Docta] ❌ Record creation failed:', err);
        setError('Analysis complete but failed to save. Please try again.');
        setPhase('error');
      }
    })();
  }, [workflow.isFinished, workflow.finalOutput]);

  const handleFileSelect = (f: File) => {
    const ext = f.name.toLowerCase().split('.').pop();
    if (!['pdf', 'docx', 'doc', 'txt'].includes(ext ?? '')) {
      setError('Only PDF, DOCX, and TXT files are supported.');
      return;
    }
    setFile(f);
    setError('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setPhase('extracting');
    setError('');
    setActiveStep(-1);

    try {
      // Step 1: Extract text from file
      const form = new FormData();
      form.append('file', file);
      const extractRes = await fetch('/api/extract', { method: 'POST', body: form });
      if (!extractRes.ok) throw new Error('Failed to extract text from file');
      const meta = await extractRes.json();
      setExtractMeta(meta);
      setExtractedText(meta.text);
      console.log('[Docta] Extracted:', meta.wordCount, 'words,', meta.pageCount, 'pages');

      // Step 2: Start 3-agent workflow
      setPhase('analyzing');
      setActiveStep(0);

      // Animate through pipeline steps
      const animatePipeline = async () => {
        for (let i = 0; i < PIPELINE_STEPS.length; i++) {
          setActiveStep(i);
          await new Promise(r => setTimeout(r, 8000)); // ~8s per agent
        }
      };

      await Promise.all([
        workflow.start({
          document_text: meta.text.slice(0, 40000), // cap for LLM context
          doc_title: file.name.replace(/\.[^.]+$/, ''),
        }),
        animatePipeline(),
      ]);

    } catch (err: any) {
      console.error('[Docta] Error:', err);
      setError(err?.message ?? 'Analysis failed. Please try again.');
      setPhase('error');
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Analyze Contract</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Upload any contract — our 3-agent AI pipeline extracts clauses, scores risk, and generates negotiation advice.
        </p>
      </div>

      {/* Upload zone */}
      {phase === 'idle' || phase === 'error' ? (
        <>
          <div
            className="glass"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : file ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-lg)', padding: 48, textAlign: 'center',
              cursor: file ? 'default' : 'pointer',
              background: dragOver ? 'rgba(108,99,255,0.05)' : 'var(--surface)',
              transition: 'all 0.2s', marginBottom: 20,
            }}
          >
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />

            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(108,99,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={22} color="var(--accent)" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontWeight: 600, fontSize: 15 }}>{file.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {(file.size / 1024).toFixed(0)} KB · {file.name.split('.').pop()?.toUpperCase()}
                  </p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4 }}>
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(108,99,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Upload size={24} color="var(--accent)" />
                </div>
                <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Drop your contract here</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>or click to browse · PDF, DOCX, TXT</p>
              </>
            )}
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: 13, marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button className="btn btn-primary" disabled={!file} onClick={handleAnalyze} style={{ width: '100%', justifyContent: 'center', padding: '14px 20px', fontSize: 15 }}>
            Start AI Analysis <ChevronRight size={16} />
          </button>
        </>
      ) : phase === 'extracting' ? (
        <div className="glass" style={{ padding: 40, textAlign: 'center' }}>
          <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTop: '3px solid var(--accent)', borderRadius: '50%', margin: '0 auto 20px' }} />
          <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Extracting document text...</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Reading your {file?.name?.split('.').pop()?.toUpperCase()} file</p>
        </div>
      ) : phase === 'analyzing' || phase === 'done' ? (
        <div className="glass" style={{ padding: 32 }}>
          <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            {phase === 'done' ? '✅ Analysis Complete!' : 'AI Pipeline Running...'}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>
            {phase === 'done' ? 'Redirecting to your results...' : '3 specialized agents are analyzing your contract'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PIPELINE_STEPS.map((step, i) => {
              const isDone = phase === 'done' || i < activeStep;
              const isActive = phase !== 'done' && i === activeStep;
              return (
                <div key={step.id} className={`pipeline-node ${isActive ? 'active' : isDone ? 'done' : ''}`}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isDone ? 'rgba(34,197,94,0.15)' : isActive ? 'rgba(108,99,255,0.15)' : 'var(--surface)' }}>
                    {isDone
                      ? <CheckCircle size={16} color="#22c55e" />
                      : isActive
                        ? <Loader2 size={16} color="var(--accent)" className="spin" />
                        : <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 700 }}>{i + 1}</span>
                    }
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: isDone ? '#22c55e' : isActive ? 'var(--text)' : 'var(--text-muted)' }}>
                      {step.label}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 1 }}>{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
