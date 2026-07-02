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
      // mammoth is in serverExternalPackages — safe to require at runtime
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      text = result.value ?? '';
    } else {
      // Plain text
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

// ─── PDF extraction via pdfjs-dist v3 (legacy CommonJS build) ────────────────
// pdfjs-dist is in serverExternalPackages so it is NOT bundled by Turbopack.
// The require() here is resolved at runtime from node_modules — no build-time
// static analysis issues.

async function extractPdf(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  // Disable worker for server-side execution
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    verbosity: 0,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages: number = pdfDoc.numPages;
  let fullText = '';

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items as Array<{ str?: string }>)
      .map(item => item.str ?? '')
      .join(' ');
    fullText += pageText + '\n';
  }

  return { text: fullText, pageCount: numPages };
}
