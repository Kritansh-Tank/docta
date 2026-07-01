// Runs as a standalone Node.js child process — never bundled by Turbopack
// Input: raw PDF/DOCX/TXT bytes via stdin
// Output: JSON { text, pageCount, wordCount } via stdout

const path = require('path');
const { argv } = process;
const fileType = argv[2]; // 'pdf' | 'docx' | 'txt'

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  let text = '';
  let pageCount = 1;

  if (fileType === 'pdf') {
    // Use lib path directly — bypasses top-level test-data loading
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const result = await pdfParse(buffer);
    text = result.text ?? '';
    pageCount = result.numpages ?? 1;
  } else if (fileType === 'docx') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    text = result.value ?? '';
  } else {
    text = buffer.toString('utf-8');
  }

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  process.stdout.write(JSON.stringify({ text: text.trim(), pageCount, wordCount }));
}

main().catch(err => {
  process.stderr.write(err.message ?? String(err));
  process.exit(1);
});
