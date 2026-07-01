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
      text = await extractPdfText(buffer);
      // Count pages via a quick scan
      const matches = buffer.toString('binary').match(/\/Page\b/g);
      pageCount = matches ? Math.max(1, Math.floor(matches.length / 2)) : 1;

    } else if (fileType === 'docx') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      text = result.value ?? '';

    } else {
      text = buffer.toString('utf-8');
    }
  } catch (err: any) {
    console.error('[Docta Extract] extraction error:', err.message);
    return NextResponse.json(
      { error: `Extraction failed: ${err.message}` },
      { status: 500 }
    );
  }

  if (!text || text.trim().length < 10) {
    return NextResponse.json(
      { error: 'Could not extract readable text. Try a .txt or .docx file if using a scanned PDF.' },
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

// ─── PDF extraction: pdfjs-dist first, pdf-parse fallback ────────────────────

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Method 1: pdfjs-dist (handles modern Chrome-printed PDFs well)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = ''; // server-side: no worker

    const uint8 = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true });
    const pdfDoc = await loadingTask.promise;

    let fullText = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const pageText = (content.items as any[])
        .map((item: any) => item.str ?? '')
        .join(' ');
      fullText += pageText + '\n';
    }

    if (fullText.trim().length > 10) {
      console.log(`[Docta Extract] pdfjs-dist extracted ${fullText.trim().length} chars`);
      return fullText;
    }
  } catch (e: any) {
    console.warn('[Docta Extract] pdfjs-dist failed:', e.message);
  }

  // Method 2: pdf-parse fallback
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const result = await pdfParse(buffer);
    const t = result.text ?? '';
    if (t.trim().length > 10) {
      console.log(`[Docta Extract] pdf-parse extracted ${t.trim().length} chars`);
      return t;
    }
  } catch (e: any) {
    console.warn('[Docta Extract] pdf-parse failed:', e.message);
  }

  return '';
}
