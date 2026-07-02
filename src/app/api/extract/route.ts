import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

  let text = '';
  let pageCount = 1;

  try {
    if (fileType === 'pdf') {
      const extracted = await extractPdf(buffer);
      text = extracted.text;
      pageCount = extracted.pageCount;
    } else if (fileType === 'docx') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      text = result.value ?? '';
    } else {
      text = buffer.toString('utf-8');
    }
  } catch (err: any) {
    console.error('[Docta Extract] error:', err.message);
    return NextResponse.json({ error: `Extraction failed: ${err.message}` }, { status: 500 });
  }

  if (!text || text.trim().length < 10) {
    return NextResponse.json(
      { error: 'Could not extract readable text. File may be scanned/image-only.' },
      { status: 422 }
    );
  }

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  return NextResponse.json({
    text: text.trim(),
    pageCount,
    wordCount,
    fileName: file.name,
    fileType: fileType.toUpperCase(),
  });
}

// ─── PDF extraction ───────────────────────────────────────────────────────────
// Uses unpdf — a serverless-safe PDF extractor built on top of PDF.js
// Does NOT require canvas or any native modules, works in Vercel Lambda

async function extractPdf(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  try {
    // unpdf is ESM — use dynamic import
    const { extractText } = await import('unpdf');
    const uint8 = new Uint8Array(buffer);
    const { totalPages, text } = await extractText(uint8, { mergePages: true });
    console.log(`[Docta Extract] unpdf extracted ${text?.length ?? 0} chars from ${totalPages} pages`);
    if (text && text.trim().length > 10) {
      return { text, pageCount: totalPages };
    }
  } catch (e: any) {
    console.warn('[Docta Extract] unpdf failed:', e.message);
  }

  // Fallback: pdf-parse (lib entry avoids test-file loading issues)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const result = await pdfParse(buffer);
    const t: string = result.text ?? '';
    console.log(`[Docta Extract] pdf-parse extracted ${t.trim().length} chars`);
    if (t.trim().length > 10) {
      return { text: t, pageCount: result.numpages ?? 1 };
    }
  } catch (e: any) {
    console.warn('[Docta Extract] pdf-parse failed:', e.message);
  }

  return { text: '', pageCount: 1 };
}
