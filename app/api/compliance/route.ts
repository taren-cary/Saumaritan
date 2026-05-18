import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function safeParseJSON(raw: string): any {
  if (!raw || !raw.trim()) return null;
  try { return JSON.parse(raw); } catch {}
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch {}
  }
  return null;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const UNALLOWABLE_KEYWORDS = [
  'entertainment', 'alcohol', 'beer', 'wine', 'liquor', 'spirits', 'cocktail',
  'happy hour', 'bar tab', 'party', 'gala', 'celebration', 'social event',
  'appreciation dinner', 'holiday party', 'team building', 'farewell',
  'retirement party', 'fundrais', 'donor', 'lobby', 'lobbying', 'political',
  'campaign', 'donation', 'first class', 'business class', 'upgrade',
  'bonus', 'sporting event', 'game ticket', 'concert', 'theater',
  'golf', 'spa', 'resort', 'minibar', 'total wine', 'liquor store',
  'advocacy coalition', 'gift', 'flowers', 'reception', 'award ceremony',
  'recognition dinner', 'staff appreciation', 'employee appreciation',
  'board dinner', 'executive bonus', 'performance bonus', 'catering',
  'banquet', 'tickets', 'admission', 'membership fee',
];

function preScreen(t: any, periodStart: Date | null, periodEnd: Date | null): string[] {
  const flags: string[] = [];
  const text = `${t.description || ''} ${t.vendor || ''}`.toLowerCase();

  if (t.date && periodStart) {
    const d = new Date(t.date);
    if (d < periodStart) flags.push('OUT_OF_PERIOD:before start date');
    if (periodEnd && d > periodEnd) flags.push('OUT_OF_PERIOD:after end date');
  }
  if (!t.date) flags.push('NO_DATE');

  for (const kw of UNALLOWABLE_KEYWORDS) {
    if (text.includes(kw)) { flags.push(`UNALLOWABLE_KEYWORD:"${kw}"`); break; }
  }

  const vendor = (t.vendor || '').toLowerCase().trim();
  if (!vendor || ['unknown', 'cash', 'n/a', ''].includes(vendor)) flags.push('NO_VENDOR');

  const desc = (t.description || '').toLowerCase().trim();
  if (!desc || desc.length < 6 || ['misc', 'miscellaneous', 'other', 'expense', 'cost', 'supplies'].includes(desc)) {
    flags.push('VAGUE_DESCRIPTION');
  }

  if (Number(t.amount) >= 5000 && !t.budget_category) flags.push('LARGE_UNCATEGORIZED');

  return flags;
}

export async function POST(req: NextRequest) {
  const { grant_id, date_from, date_to } = await req.json();
  if (!grant_id) return NextResponse.json({ error: 'grant_id required' }, { status: 400 });

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured in .env' }, { status: 500 });
  }

  // Build transaction query — only pending_review, optionally filtered by date range
  let txQuery = supabase.from('transactions').select('*').eq('grant_id', grant_id).eq('allowability_status', 'pending_review');
  if (date_from) txQuery = txQuery.gte('date', date_from);
  if (date_to) txQuery = txQuery.lte('date', date_to);
  txQuery = txQuery.order('date', { ascending: true });

  const [grantRes, reqRes, txRes, budgetRes] = await Promise.all([
    supabase.from('grants').select('*, organizations(name)').eq('id', grant_id).single(),
    supabase.from('grant_requirements').select('*').eq('grant_id', grant_id).eq('is_active', true),
    txQuery,
    supabase.from('budget_line_items').select('*').eq('grant_id', grant_id),
  ]);

  if (grantRes.error) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });

  const grant = grantRes.data;
  const requirements = reqRes.data ?? [];
  const transactions = txRes.data ?? [];
  const budgetItems = budgetRes.data ?? [];
  const year = grant.period_end ? new Date(grant.period_end).getFullYear() : new Date().getFullYear();

  const periodStart = grant.period_start ? new Date(grant.period_start) : null;
  const periodEnd = grant.period_end ? new Date(grant.period_end) : null;

  // Budget actuals
  const budgetActuals: Record<string, number> = {};
  for (const t of transactions) {
    if (t.budget_category) budgetActuals[t.budget_category] = (budgetActuals[t.budget_category] ?? 0) + (Number(t.amount) || 0);
  }
  const budgetSummary = budgetItems.map(b => {
    const actual = budgetActuals[b.category] ?? 0;
    const approved = Number(b.approved_amount);
    const over = actual > approved;
    return `${b.category}: approved=$${approved.toLocaleString()} spent=$${actual.toLocaleString()}${over ? ` *** OVER BUDGET by $${(actual - approved).toLocaleString()} ***` : ''}`;
  }).join('\n');

  // Pre-screen all transactions with rule-based flags
  const screened = transactions.map(t => ({ ...t, _flags: preScreen(t, periodStart, periodEnd) }));
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const PHASE1_CHUNK = 150;
  const PHASE2_MAX = 200;

  const phase1System = `You are a federal grant compliance transaction scanner. Your ONLY job right now is to flag every suspicious transaction. Do NOT write findings yet — just identify which transactions need investigation.

Be aggressive. Over-flagging is far better than missing a violation. Include ALL pre-flagged transactions plus any others you find suspicious.

Flag transactions that have:
- ANY suggestion of entertainment, alcohol, social events, parties, galas, fundraising, lobbying, political activity
- First class or business class travel
- Bonuses not clearly in a compensation plan
- Missing or vague descriptions ("misc", "supplies", "meeting" with no context)
- Missing vendor names or "cash" / "unknown" vendors
- Suspiciously round numbers for large amounts ($5,000, $10,000, $25,000)
- The same vendor appearing with the same or similar amount within 7 days (duplicate payment)
- Multiple purchases just under $10,000 from the same vendor (threshold splitting)
- Costs that appear to be for the organization's benefit rather than the grant program
- Any amount that seems disproportionate or unjustified given the description
- Purchases from vendors inconsistent with the grant program purpose

Return ONLY valid JSON: { "flagged": [{ "id": "<exact transaction id>", "reason": "<why flagged>", "concern": "<unallowable|duplicate|procurement|period|documentation|budget|other>" }] }`;

  try {
    // ── PHASE 1: CHUNKED TRIAGE ───────────────────────────────────────────────
    // Split into chunks of 150 so large ledgers don't overflow context windows
    const chunks: typeof screened[] = [];
    for (let i = 0; i < screened.length; i += PHASE1_CHUNK) {
      chunks.push(screened.slice(i, i + PHASE1_CHUNK));
    }

    const globalAiFlaggedMap = new Map<string, { id: string; reason: string; concern: string }>();

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      const txLines = chunk.map(t => {
        const flagStr = t._flags.length > 0 ? ` [PRE-FLAGGED: ${t._flags.join(', ')}]` : '';
        return `ID:${t.id}|${t.date || 'NO_DATE'}|"${t.description || ''}"|"${t.vendor || 'NO_VENDOR'}"|$${t.amount}|${t.budget_category || 'uncat'}${flagStr}`;
      }).join('\n');

      const phase1Response = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: phase1System },
          { role: 'user', content: `PERIOD OF PERFORMANCE: ${grant.period_start} to ${grant.period_end}\nGRANT TYPE: ${grant.grant_type} | AGENCY: ${grant.awarding_agency || 'N/A'}\n\nSCAN BATCH ${ci + 1} OF ${chunks.length} (${chunk.length} transactions):\n${txLines}` },
        ],
        temperature: 0.0,
        max_tokens: 4000,
      });

      const phase1Raw = phase1Response.choices[0]?.message?.content ?? '{"flagged":[]}';
      const phase1Result = safeParseJSON(phase1Raw) ?? { flagged: [] };
      const { flagged: aiFlagged } = phase1Result as { flagged: { id: string; reason: string; concern: string }[] };
      for (const f of aiFlagged) {
        if (!globalAiFlaggedMap.has(f.id)) globalAiFlaggedMap.set(f.id, f);
      }
    }

    // Merge rule-based + AI flagged across all chunks
    const preScreenedIds = new Set(screened.filter(t => t._flags.length > 0).map(t => t.id));
    const allFlaggedIds = new Set([...preScreenedIds, ...globalAiFlaggedMap.keys()]);

    const allFlaggedTxs = screened
      .filter(t => allFlaggedIds.has(t.id))
      .map(t => ({
        ...t,
        _aiReason: globalAiFlaggedMap.get(t.id)?.reason ?? null,
        _aiConcern: globalAiFlaggedMap.get(t.id)?.concern ?? null,
      }));

    // Cap Phase 2 at PHASE2_MAX — Phase 2 uses o1 which is expensive and slow
    const flaggedTxs = allFlaggedTxs.slice(0, PHASE2_MAX);
    if (allFlaggedTxs.length > PHASE2_MAX) {
      console.log(`[compliance] ${allFlaggedTxs.length} flagged — capping Phase 2 at ${PHASE2_MAX}. Run again to cover the rest.`);
    }

    // ── PHASE 2: GAGAS FINDINGS ───────────────────────────────────────────────
    const phase2System = `You are a senior federal grant compliance auditor generating formal GAGAS audit findings (Government Auditing Standards 2018, Yellow Book). You have been given a pre-screened list of suspicious transactions identified by both automated rules and AI triage.

Your job: group related violations into formal findings and write each finding using the complete 5-element GAGAS structure. Be thorough, specific, and professional. Each finding must cite the exact regulation violated.

GROUPING RULES:
- All transactions violating the same requirement = ONE finding
- Out-of-period transactions = one finding (cite 2 CFR §200.309)
- All entertainment/alcohol/unallowable = one finding per unallowable category
- Documentation deficiencies across multiple transactions = one finding
- Budget overages per category = one finding per category
- Duplicate payments = one finding
- Procurement violations = one finding

Do NOT bundle unrelated violations together. Do NOT omit any flagged transaction from your analysis — every pre-screened and AI-flagged transaction must appear in at least one finding.

Return ONLY valid JSON.`;

    const reqText = requirements.length === 0
      ? 'No specific requirements defined — apply full 2 CFR Part 200 Subpart E.'
      : requirements.map((r, i) => `REQ ${i + 1}: [${r.category}] ${r.title} | Citation: ${r.regulatory_citation || 'N/A'} | Rule: ${r.description} | Max: ${r.max_amount ? '$' + r.max_amount : 'none'}`).join('\n');

    const flaggedLines = flaggedTxs.map(t =>
      `ID: ${t.id}
  Date: ${t.date || 'MISSING'} | Vendor: "${t.vendor || 'NONE'}" | Amount: $${t.amount}
  Description: "${t.description || 'NONE'}" | Budget Category: ${t.budget_category || 'UNCATEGORIZED'}
  Rule-Based Flags: ${t._flags.length > 0 ? t._flags.join(', ') : 'none'}
  AI Triage Reason: ${t._aiReason || 'none'}`
    ).join('\n\n');

    const phase2Response = await openai.chat.completions.create({
      model: 'o1',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: phase2System },
        { role: 'user', content: `=== GRANT ===
Name: ${grant.name} | Org: ${(grant as any).organizations?.name}
Grant #: ${grant.grant_number || 'N/A'} | Agency: ${grant.awarding_agency || 'N/A'} | CFDA: ${grant.cfda_number || 'N/A'}
Period: ${grant.period_start} to ${grant.period_end}
Award: $${grant.award_amount?.toLocaleString()} | Indirect: ${grant.indirect_cost_rate}% (${grant.indirect_cost_type})
Matching: ${grant.matching_required ? `YES — ${grant.match_percentage}%` : 'No'}

=== GRANT REQUIREMENTS ===
${reqText}

=== BUDGET vs ACTUAL ===
${budgetSummary || 'No budget entered.'}

=== ${flaggedTxs.length} FLAGGED TRANSACTIONS (out of ${transactions.length} total) — WRITE A FINDING FOR EVERY ONE ===
${flaggedLines}

=== OUTPUT FORMAT ===
{
  "overall_score": <0-100>,
  "summary": "<3-4 sentences: number of findings, total questioned costs, most serious issues, overall compliance assessment>",
  "total_questioned_costs": <sum of all questioned_costs>,
  "findings": [
    {
      "finding_ref": "${year}-001",
      "severity": "<material_weakness|significant_deficiency|material_noncompliance|other>",
      "category": "<compliance category>",
      "condition_text": "<SPECIFIC: what was found, exact transactions, exact amounts, exact dates>",
      "criteria": "<exact regulatory citation quoted precisely — include section number and rule text>",
      "cause": "<root cause: policy gap, training failure, intentional circumvention, inadequate controls>",
      "effect": "<dollar impact + risk: repayment required, audit finding, potential loss of funding>",
      "recommendation": "<specific corrective action the organization must take>",
      "questioned_costs": <dollar amount>,
      "transaction_ids": ["<exact IDs from flagged list>"],
      "is_repeat": false
    }
  ]
}` },
      ],
      max_completion_tokens: 32000,
    });

    const phase2Raw = phase2Response.choices[0]?.message?.content ?? '{}';
    const result = safeParseJSON(phase2Raw);
    if (!result) throw new Error('Phase 2 returned invalid JSON — try again or reduce transaction count');

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

    const validTxIds = new Set(transactions.map(t => t.id));
    const findings = Array.isArray(result.findings) ? result.findings : [];
    if (!findings.length) console.log('[compliance] Phase 2 returned 0 findings for this run');

    for (const f of findings) {
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

    // Mark all cited transactions as 'questioned' so they surface in filters and dashboard
    const allCitedIds = findings
      .flatMap((f: any) => f.transaction_ids ?? [])
      .filter((id: string) => validTxIds.has(id));

    if (allCitedIds.length > 0) {
      const { error: statusError } = await supabase
        .from('transactions')
        .update({ allowability_status: 'questioned' })
        .in('id', allCitedIds);
      if (statusError) console.error('[compliance] Failed to update transaction statuses:', statusError);
    }

    return NextResponse.json({
      reportId: report.id,
      stats: {
        totalTransactions: transactions.length,
        flaggedInPhase1: flaggedTxs.length,
        findingsGenerated: result.findings?.length ?? 0,
      },
    });

  } catch (err: any) {
    console.error('Compliance generation error:', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
