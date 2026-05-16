import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function getRiskLevel(amount: any): 'low' | 'medium' | 'high' {
  const n = parseFloat(String(amount ?? 0).replace(/[^0-9.-]/g, ''));
  if (isNaN(n) || n < 500) return 'low';
  if (n < 5000) return 'medium';
  return 'high';
}

function safeParseJSON(raw: string): any {
  try { return JSON.parse(raw); } catch {}
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s !== -1 && e > s) { try { return JSON.parse(raw.slice(s, e + 1)); } catch {} }
  return null;
}

async function extractFromImage(openai: OpenAI, buffer: Buffer, mimeType: string): Promise<any[]> {
  const base64 = buffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    max_tokens: 2000,
    temperature: 0,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        {
          type: 'text',
          text: `Extract all financial transactions from this image. It may be a receipt, invoice, bank statement, or other financial document.

For each transaction or line item extract:
- date: transaction date (YYYY-MM-DD if possible, otherwise as shown)
- description: what was purchased or the transaction memo
- vendor: the business or payee name
- amount: dollar amount as a positive number (no currency symbols)

Return ONLY JSON: { "transactions": [{ "date": "...", "description": "...", "vendor": "...", "amount": 0.00 }] }

If multiple line items exist return all of them. If only one transaction return a single-item array. If no financial data is found return { "transactions": [] }.`,
        },
      ],
    }],
  });

  const result = safeParseJSON(res.choices[0]?.message?.content ?? '{}');
  return result?.transactions ?? [];
}

async function extractFromPDFText(openai: OpenAI, text: string, filename: string): Promise<any[]> {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    max_tokens: 3000,
    temperature: 0,
    messages: [{
      role: 'user',
      content: `The following text was extracted from a financial document (${filename}). Extract every individual financial transaction.

For each transaction extract:
- date: transaction date (YYYY-MM-DD if possible)
- description: transaction description or memo
- vendor: payee or vendor name
- amount: dollar amount as a positive number

Return ONLY JSON: { "transactions": [{ "date": "...", "description": "...", "vendor": "...", "amount": 0.00 }] }

If no transactions found return { "transactions": [] }.

DOCUMENT TEXT:
${text.slice(0, 12000)}`,
    }],
  });

  const result = safeParseJSON(res.choices[0]?.message?.content ?? '{}');
  return result?.transactions ?? [];
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured in .env' }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const grantId = formData.get('grant_id') as string | null;

  if (!file || !grantId) {
    return NextResponse.json({ error: 'file and grant_id are required' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const mimeType = file.type || '';
  const isPDF = mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = mimeType.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|gif)$/i.test(file.name);

  if (!isPDF && !isImage) {
    return NextResponse.json({ error: 'Unsupported file type. Upload a PDF or image.' }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    let extracted: any[] = [];
    let method = '';

    if (isImage) {
      method = 'vision';
      extracted = await extractFromImage(openai, buffer, mimeType || 'image/jpeg');
    } else {
      // Try text extraction first
      let pdfText = '';
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfModule = await import('pdf-parse') as any;
        const pdfParse = pdfModule.default ?? pdfModule;
        const parsed = await pdfParse(buffer);
        pdfText = parsed.text?.trim().replace(/\s+/g, ' ') ?? '';
      } catch {}

      if (pdfText.length >= 100) {
        // Digital PDF — use text extraction
        method = 'pdf-text';
        extracted = await extractFromPDFText(openai, pdfText, file.name);
      } else {
        // Scanned PDF — fall back to vision on first page
        method = 'vision-pdf';
        // Encode the raw PDF as an image isn't possible directly — use vision on the PDF buffer
        // OpenAI vision doesn't accept PDFs, so we tell the user to use images for scanned docs
        return NextResponse.json({
          error: 'This appears to be a scanned PDF (no readable text layer). Please take a photo or screenshot of each page and upload as JPG or PNG instead.',
        }, { status: 422 });
      }
    }

    if (extracted.length === 0) {
      return NextResponse.json({
        error: 'No transactions could be extracted from this file. Check that it contains financial data.',
        count: 0,
      }, { status: 422 });
    }

    // Build records for Supabase
    const records = extracted
      .filter(t => t.amount != null && !isNaN(parseFloat(String(t.amount))))
      .map(t => {
        const amt = parseFloat(String(t.amount).replace(/[^0-9.-]/g, ''));
        return {
          grant_id: grantId,
          date: t.date || null,
          description: t.description || null,
          vendor: t.vendor || null,
          amount: isNaN(amt) ? null : amt,
          budget_category: null,
          risk_level: getRiskLevel(amt),
          status: 'pending',
          allowability_status: 'pending_review',
          source_file: file.name,
          raw_data: t,
        };
      });

    if (records.length === 0) {
      return NextResponse.json({
        error: 'No valid transactions with amounts found in this file.',
        count: 0,
      }, { status: 422 });
    }

    const { error: dbError } = await supabase.from('transactions').insert(records);
    if (dbError) throw dbError;

    return NextResponse.json({ count: records.length, method });
  } catch (err: any) {
    console.error('Upload extraction error:', err);
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 });
  }
}
