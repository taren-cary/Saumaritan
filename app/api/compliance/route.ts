import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { grant_id } = await req.json();
  if (!grant_id) return NextResponse.json({ error: 'grant_id required' }, { status: 400 });

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured in .env' }, { status: 500 });
  }

  // Fetch all data for this grant
  const [grantRes, reqRes, txRes, budgetRes] = await Promise.all([
    supabase.from('grants').select('*, organizations(name)').eq('id', grant_id).single(),
    supabase.from('grant_requirements').select('*').eq('grant_id', grant_id).eq('is_active', true),
    supabase.from('transactions').select('*').eq('grant_id', grant_id).order('date', { ascending: true }),
    supabase.from('budget_line_items').select('*').eq('grant_id', grant_id),
  ]);

  if (grantRes.error) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });

  const grant = grantRes.data;
  const requirements = reqRes.data ?? [];
  const transactions = txRes.data ?? [];
  const budgetItems = budgetRes.data ?? [];

  const year = grant.period_end ? new Date(grant.period_end).getFullYear() : new Date().getFullYear();

  const systemPrompt = `You are an expert federal grant compliance auditor with deep knowledge of 2 CFR Part 200 (Uniform Guidance) and GAGAS (Government Auditing Standards). Generate GAGAS-compliant audit findings. Return ONLY valid JSON, no other text.`;

  const userPrompt = `GRANT: ${grant.name}
Grant #: ${grant.grant_number || 'N/A'} | Agency: ${grant.awarding_agency || 'N/A'} | CFDA/ALN: ${grant.cfda_number || 'N/A'}
Type: ${grant.grant_type} | Funder: ${grant.funder_name || 'N/A'}
Award Amount: $${grant.award_amount?.toLocaleString() || 'N/A'}
Period: ${grant.period_start || 'N/A'} to ${grant.period_end || 'N/A'}
Indirect Cost: ${grant.indirect_cost_rate || 'N/A'}% (${grant.indirect_cost_type || 'N/A'})
Matching: ${grant.matching_required ? `Required - ${grant.match_percentage}%` : 'Not required'}
Organization: ${(grant as any).organizations?.name || 'N/A'}

GRANT REQUIREMENTS (${requirements.length} defined):
${requirements.length === 0 ? 'No requirements defined.' : requirements.map((r, i) => `${i + 1}. [${r.category}] ${r.title}
   Citation: ${r.regulatory_citation || 'N/A'}
   Description: ${r.description}
   Max Amount: ${r.max_amount ? '$' + r.max_amount : 'N/A'}
   Documentation Required: ${r.documentation_required || 'N/A'}`).join('\n\n')}

APPROVED BUDGET:
${budgetItems.length === 0 ? 'No approved budget entered.' : budgetItems.map(b => `${b.category}: $${Number(b.approved_amount).toLocaleString()}`).join('\n')}

TRANSACTIONS TO REVIEW (${transactions.length} total, total value: $${transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0).toLocaleString()}):
${transactions.length === 0 ? 'No transactions uploaded yet.' : transactions.slice(0, 200).map(t => `ID:${t.id} | Date:${t.date || 'unknown'} | Desc:${t.description || 'none'} | Vendor:${t.vendor || 'unknown'} | Amount:$${t.amount} | Category:${t.budget_category || t.category || 'uncat'}`).join('\n')}

Analyze for compliance violations. Consider:
- Costs outside the period of performance (${grant.period_start} to ${grant.period_end})
- Unallowable costs per 2 CFR 200 (entertainment, alcohol, lobbying, fundraising, fines)
- Costs exceeding approved budget line items
- Large transactions lacking documentation context
- Unusual vendor amounts or patterns
- Any violation of the defined grant requirements above
- Missing or inadequate budget categorization

Return JSON:
{
  "overall_score": <0-100>,
  "summary": "<2-3 sentence executive summary>",
  "total_questioned_costs": <number>,
  "findings": [
    {
      "finding_ref": "${year}-001",
      "severity": "<material_weakness|significant_deficiency|material_noncompliance|other>",
      "category": "<requirement category>",
      "condition_text": "<specific factual description of what was found>",
      "criteria": "<full regulatory citation and requirement text violated>",
      "cause": "<root cause>",
      "effect": "<actual/potential impact with dollar amount if applicable>",
      "recommendation": "<specific corrective action>",
      "questioned_costs": <number>,
      "transaction_ids": ["<only real transaction IDs from the list above>"],
      "is_repeat": false
    }
  ]
}`;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const result = JSON.parse(raw);

    // Save report
    const { data: report, error: reportError } = await supabase
      .from('compliance_reports')
      .insert({
        grant_id,
        overall_score: result.overall_score ?? 0,
        total_questioned_costs: result.total_questioned_costs ?? 0,
        summary: result.summary ?? '',
        status: 'complete',
      })
      .select()
      .single();

    if (reportError) throw reportError;

    // Get valid transaction IDs for this grant
    const validTxIds = new Set(transactions.map(t => t.id));

    // Save findings
    for (const f of result.findings ?? []) {
      const { data: finding, error: findingError } = await supabase
        .from('compliance_findings')
        .insert({
          report_id: report.id,
          finding_ref: f.finding_ref,
          severity: f.severity,
          category: f.category,
          condition_text: f.condition_text,
          criteria: f.criteria,
          cause: f.cause,
          effect: f.effect,
          recommendation: f.recommendation,
          questioned_costs: f.questioned_costs ?? 0,
          is_repeat: f.is_repeat ?? false,
        })
        .select()
        .single();

      if (findingError || !finding) continue;

      const cited = (f.transaction_ids ?? []).filter((id: string) => validTxIds.has(id));
      if (cited.length > 0) {
        await supabase.from('finding_transactions').insert(
          cited.map((tid: string) => ({ finding_id: finding.id, transaction_id: tid }))
        );
      }
    }

    return NextResponse.json({ reportId: report.id });
  } catch (err: any) {
    console.error('Compliance generation error:', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
