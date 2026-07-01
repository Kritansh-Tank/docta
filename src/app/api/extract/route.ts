import { NextRequest, NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import { resolve } from 'path';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel: allow up to 60s for PDF extraction

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name.toLowerCase();

  let fileType: string;
  if (fileName.endsWith('.pdf')) fileType = 'pdf';
  else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) fileType = 'docx';
  else if (fileName.endsWith('.txt')) fileType = 'txt';
  else {
    return NextResponse.json(
      { error: 'Unsupported file type. Use PDF, DOCX, or TXT.' },
      { status: 400 }
    );
  }

  const scriptPath = resolve(process.cwd(), 'scripts/extract-text.cjs');

  const proc = spawnSync('node', [scriptPath, fileType], {
    input: buffer,
    timeout: 45_000,
    maxBuffer: 50 * 1024 * 1024, // 50 MB output buffer
  });

  if (proc.error) {
    console.error('[Docta Extract] spawn error:', proc.error.message);
    return NextResponse.json({ error: 'Failed to start extraction process' }, { status: 500 });
  }

  if (proc.status !== 0) {
    const stderr = proc.stderr?.toString() ?? 'Unknown error';
    console.error('[Docta Extract] script error:', stderr);
    return NextResponse.json({ error: `Extraction failed: ${stderr}` }, { status: 500 });
  }

  let result: { text: string; pageCount: number; wordCount: number };
  try {
    result = JSON.parse(proc.stdout.toString());
  } catch {
    console.error('[Docta Extract] Bad JSON output');
    return NextResponse.json({ error: 'Extraction produced invalid output' }, { status: 500 });
  }

  if (!result.text || result.text.trim().length < 10) {
    return NextResponse.json(
      { error: 'Could not extract readable text. File may be scanned/image-only.' },
      { status: 422 }
    );
  }

  return NextResponse.json({
    text: result.text,
    pageCount: result.pageCount,
    wordCount: result.wordCount,
    fileName: file.name,
    fileType: fileType.toUpperCase(),
  });
}
