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

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured in .env' }, { status: 500 });
  }

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }); }

  const file = formData.get('file') as File | null;
  const grantId = formData.get('grant_id') as string | null;

  if (!file || !grantId) {
    return NextResponse.json({ error: 'file and grant_id are required' }, { status: 400 });
  }

  const mimeType = file.type || '';
  const isImage = mimeType.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|gif)$/i.test(file.name);

  if (!isImage) {
    return NextResponse.json({ error: 'Unsupported file type. Upload an image (JPG, PNG, WEBP) or use the PDF converter.' }, { status: 400 });
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${base64}`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
            text: `Extract all financial transactions from this image. It may be a receipt, invoice, bank statement, or scanned financial document.

For each transaction or line item extract:
- date: transaction date (YYYY-MM-DD format if possible, otherwise as shown)
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
    const extracted: any[] = result?.transactions ?? [];

    if (extracted.length === 0) {
      return NextResponse.json({ error: 'No transactions found in this image.', count: 0 }, { status: 422 });
    }

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
      return NextResponse.json({ error: 'No transactions with valid amounts found.', count: 0 }, { status: 422 });
    }

    const { error: dbError } = await supabase.from('transactions').insert(records);
    if (dbError) throw dbError;

    return NextResponse.json({ count: records.length });
  } catch (err: any) {
    console.error('[upload] error:', err);
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 });
  }
}
