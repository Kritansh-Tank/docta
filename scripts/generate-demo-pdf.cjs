// generate-demo-pdf.cjs
// Run: node scripts/generate-demo-pdf.cjs
// Output: demo-contract.pdf (proper text-based PDF, fully extractable)

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({ margin: 72, size: 'A4' });
const out = path.join(__dirname, '..', 'demo-contract.pdf');
doc.pipe(fs.createWriteStream(out));

const W = doc.page.width - 144; // usable width

// ── Title ──────────────────────────────────────────────────────────────────
doc.font('Times-Bold').fontSize(15)
   .text('FREELANCE SOFTWARE DEVELOPMENT AGREEMENT', { align: 'center' });
doc.font('Times-Italic').fontSize(11)
   .text('Service Contract · Fixed-Term Engagement', { align: 'center' });
doc.moveDown(0.5);
doc.moveTo(72, doc.y).lineTo(72 + W, doc.y).stroke();
doc.moveDown(0.8);

// ── Metadata ───────────────────────────────────────────────────────────────
const meta = [
  ['Agreement Date', 'June 15, 2026'],
  ['Effective Date',  'July 1, 2026'],
  ['Agreement No.',   'NTL-DEV-2026-047'],
  ['Jurisdiction',    'Gurugram, Haryana, India'],
];
for (const [k, v] of meta) {
  doc.font('Times-Bold').fontSize(11).text(`${k}: `, { continued: true })
     .font('Times-Roman').text(v);
}
doc.moveDown(0.8);
doc.moveTo(72, doc.y).lineTo(72 + W, doc.y).stroke();
doc.moveDown(0.8);

// ── Parties ─────────────────────────────────────────────────────────────────
doc.font('Times-Roman').fontSize(11).text(
  'This Freelance Software Development Agreement ("Agreement") is entered into as of the date first written above, by and between the following parties:',
  { align: 'justify' }
);
doc.moveDown(0.6);

doc.font('Times-Bold').text('CLIENT: ', { continued: true })
   .font('Times-Roman').text(
  'NexaFlow Technologies Pvt. Ltd., a private limited company incorporated under the Companies Act, 2013, CIN: U72900HR2021PTC098312, having its Registered Office at 4th Floor, Tower B, Cyber Hub, DLF Phase 2, Gurugram, Haryana – 122 002, India (hereinafter referred to as "Client").',
  { align: 'justify' }
);
doc.moveDown(0.4);
doc.font('Times-Bold').text('— AND —', { align: 'center' });
doc.moveDown(0.4);
doc.font('Times-Bold').text('DEVELOPER: ', { continued: true })
   .font('Times-Roman').text(
  'Aryan Mehta, Indian National, PAN: BXKPM7842L, residing at 302, Green Valley Apartments, 5th Cross, Koramangala 4th Block, Bengaluru, Karnataka – 560 034, India (hereinafter referred to as "Developer").',
  { align: 'justify' }
);
doc.moveDown(0.6);
doc.font('Times-Italic').text(
  'WHEREAS, Client desires to engage Developer to provide certain software development services, and Developer is willing to perform such services, on the terms and conditions set forth herein. NOW, THEREFORE, in consideration of the mutual covenants contained herein, the parties agree as follows:',
  { align: 'justify' }
);
doc.moveDown(0.6);
doc.moveTo(72, doc.y).lineTo(72 + W, doc.y).stroke();
doc.moveDown(0.8);

// ── Clause helper ───────────────────────────────────────────────────────────
function clause(num, title, body) {
  doc.font('Times-Bold').fontSize(11).text(`${num}. ${title.toUpperCase()}`);
  doc.moveDown(0.2);
  doc.font('Times-Roman').fontSize(11).text(body, { align: 'justify' });
  doc.moveDown(0.6);
}

// ── Clauses ─────────────────────────────────────────────────────────────────
clause(1, 'Scope of Work',
  'Developer agrees to design, develop, test, and deliver a customer analytics dashboard for Client\'s SaaS platform ("Project"), including backend API integration, real-time data visualization components, and production deployment support. Client may modify the scope of work by written notice, and Developer shall comply with such modifications within timelines reasonably specified by Client.'
);

clause(2, 'Term and Renewal',
  'This Agreement shall commence on July 1, 2026 and continue for an initial period of six (6) months. This Agreement shall automatically renew for successive six (6) month periods unless either party provides written notice of non-renewal at least ninety (90) days prior to the expiration of the then-current term. Failure to provide timely notice shall result in automatic renewal and Developer\'s continued obligation to perform services for the renewed term.'
);

clause(3, 'Compensation and Payment',
  'Client shall pay Developer a fixed monthly fee of INR 1,20,000 (Indian Rupees One Lakh Twenty Thousand only), subject to applicable TDS deductions. Developer shall submit invoices on the first business day of each calendar month. Payment shall be made within forty-five (45) days of receipt of invoice. Client reserves the right to withhold, adjust, or offset any payment if, in Client\'s sole and absolute discretion, deliverables are deemed incomplete, unsatisfactory, or not in conformity with Client\'s requirements. No interest shall accrue on delayed payments.'
);

clause(4, 'Intellectual Property Rights',
  'All work product, source code, object code, designs, interfaces, documentation, data models, algorithms, and any other materials created, conceived, or developed by Developer in connection with this Agreement — whether or not developed during business hours, and whether or not using Developer\'s own equipment, tools, or resources — shall be and remain the sole and exclusive property of Client. Developer hereby irrevocably assigns to Client all right, title, and interest in and to all intellectual property rights throughout the world, in perpetuity. Developer waives all moral rights to the work product to the fullest extent permitted by law.'
);

clause(5, 'Confidentiality',
  'Developer shall hold in strict confidence all Confidential Information of Client and shall not disclose, copy, or use such information except as required to perform services hereunder. "Confidential Information" means any information that Client designates as confidential, whether or not marked or identified as confidential at the time of disclosure. This obligation shall survive termination for a period of five (5) years.'
);

clause(6, 'Non-Compete Restriction',
  'During the term of this Agreement and for a period of twenty-four (24) months following termination, Developer shall not, directly or indirectly, engage in, own, manage, operate, or consult for any person or entity competitive with Client\'s business — anywhere in India, Southeast Asia, the Middle East, or any other jurisdiction where Client operates or has expressed an intention to operate. Developer acknowledges that this restriction is reasonable and necessary to protect Client\'s legitimate business interests.'
);

clause(7, 'Non-Solicitation',
  'For a period of twenty-four (24) months following termination, Developer shall not: (a) solicit, recruit, or hire any employee, contractor, or consultant of Client; or (b) solicit, induce, or encourage any customer or prospective customer of Client to terminate or reduce its relationship with Client.'
);

clause(8, 'Limitation of Liability',
  'IN NO EVENT SHALL CLIENT BE LIABLE TO DEVELOPER FOR ANY INDIRECT, INCIDENTAL, SPECIAL, PUNITIVE, OR CONSEQUENTIAL DAMAGES. CLIENT\'S TOTAL AGGREGATE LIABILITY TO DEVELOPER UNDER THIS AGREEMENT SHALL NOT EXCEED INR 10,000 (TEN THOUSAND RUPEES ONLY), regardless of the form or nature of the claim, whether in contract, tort, or otherwise.'
);

clause(9, 'Termination',
  'Client may terminate this Agreement at any time, for any reason, upon seven (7) calendar days written notice to Developer. Developer may terminate only upon ninety (90) days written notice, provided all in-progress deliverables are completed. Client shall have no obligation to compensate Developer for work not formally accepted or approved by Client as of the date of termination notice.'
);

clause(10, 'Unilateral Amendment',
  'Client reserves the right to modify or amend the terms of this Agreement at any time upon seven (7) days written notice to Developer. Developer\'s continued performance shall constitute unconditional acceptance of the amended terms. Developer who does not accept the amended terms must provide ninety (90) days notice of termination.'
);

clause(11, 'Independent Contractor',
  'Developer is an independent contractor and not an employee, agent, or partner of Client. Developer is solely responsible for all taxes, insurance, and statutory contributions arising from this engagement.'
);

clause(12, 'Governing Law',
  'This Agreement shall be governed by the laws of India. Any dispute shall be subject to the exclusive jurisdiction of courts in Gurugram, Haryana.'
);

// ── Signatures ───────────────────────────────────────────────────────────────
doc.addPage();
doc.font('Times-Bold').fontSize(12).text('IN WITNESS WHEREOF', { align: 'center' });
doc.moveDown(0.4);
doc.font('Times-Italic').fontSize(11).text('The parties have executed this Agreement as of the date first written above.', { align: 'center' });
doc.moveDown(1.5);

const half = W / 2;

// Left sig block
const sy = doc.y;
doc.font('Times-Bold').fontSize(11).text('For and on behalf of Client:', { width: half });
doc.font('Times-Roman').text('NexaFlow Technologies Pvt. Ltd.', { width: half });
doc.font('Times-Italic').text('Rohan Singhania, Chief Executive Officer', { width: half });
doc.moveDown(1.5);
doc.moveTo(72, doc.y).lineTo(72 + half - 20, doc.y).stroke();
doc.moveDown(0.3);
doc.font('Times-Roman').text('Authorised Signatory', { width: half });
doc.moveDown(0.5);
doc.moveTo(72, doc.y).lineTo(72 + half - 20, doc.y).stroke();
doc.moveDown(0.3);
doc.text('Date', { width: half });

// Right sig block
const ex = doc.y;
doc.y = sy;
doc.x = 72 + half + 10;
doc.font('Times-Bold').fontSize(11).text('Developer:', { width: half });
doc.x = 72 + half + 10;
doc.font('Times-Roman').text('Aryan Mehta', { width: half });
doc.x = 72 + half + 10;
doc.font('Times-Italic').text('Freelance Software Developer', { width: half });
doc.y = ex - 50;
doc.x = 72 + half + 10;
doc.moveTo(72 + half + 10, doc.y).lineTo(72 + W, doc.y).stroke();
doc.moveDown(0.3);
doc.x = 72 + half + 10;
doc.font('Times-Roman').text('Signature', { width: half });
doc.moveDown(0.5);
doc.x = 72 + half + 10;
doc.moveTo(72 + half + 10, doc.y).lineTo(72 + W, doc.y).stroke();
doc.moveDown(0.3);
doc.x = 72 + half + 10;
doc.text('Date', { width: half });

// ── Footer ──────────────────────────────────────────────────────────────────
doc.y = doc.page.height - 72;
doc.x = 72;
doc.font('Times-Roman').fontSize(8).fillColor('#666')
   .text('NTL-DEV-2026-047 · Freelance Software Development Agreement · NexaFlow Technologies Pvt. Ltd. · Confidential', { align: 'center' });

doc.end();
console.log('✅ PDF generated:', out);
