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
      // pdf-parse is in serverExternalPackages — required at runtime, not bundled by Turbopack
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse/lib/pdf-parse.js');
      const result = await pdfParse(buffer);
      text = result.text ?? '';
      pageCount = result.numpages ?? 1;
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
