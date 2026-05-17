"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, Download, FileText, Loader2, Lock, RefreshCw, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type Transaction = { id: string; date: string | null; description: string | null; vendor: string | null; amount: number | null };
type Finding = {
  id: string; report_id: string; finding_ref: string; severity: string; category: string | null;
  condition_text: string | null; criteria: string | null; cause: string | null;
  effect: string | null; recommendation: string | null;
  questioned_costs: number; is_repeat: boolean;
  finding_transactions: { transaction_id: string; transactions: Transaction }[];
};
type RunLog = { id: string; created_at: string; finding_count: number };

interface Grant {
  name: string; grant_number: string | null; awarding_agency: string | null;
  cfda_number: string | null; award_amount: number | null;
  period_start: string | null; period_end: string | null;
  organizations: { name: string } | null;
}

const severityStyles: Record<string, { badge: string; border: string; label: string }> = {
  material_weakness: { badge: 'bg-red-100 text-red-700', border: 'border-red-300', label: 'Material Weakness' },
  significant_deficiency: { badge: 'bg-orange-100 text-orange-700', border: 'border-orange-300', label: 'Significant Deficiency' },
  material_noncompliance: { badge: 'bg-yellow-100 text-yellow-700', border: 'border-yellow-300', label: 'Material Noncompliance' },
  other: { badge: 'bg-blue-100 text-blue-700', border: 'border-blue-300', label: 'Other Finding' },
};

const fmt = (n: number) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export default function ComplianceTab({ grantId, grant }: { grantId: string; grant: Grant }) {
  const [allFindings, setAllFindings] = useState<Finding[]>([]);
  const [runLog, setRunLog] = useState<RunLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [readiness, setReadiness] = useState({ requirements: 0, transactions: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [questionedCount, setQuestionedCount] = useState(0);
  const [newTxCount, setNewTxCount] = useState(0);
  const [forceUnlocked, setForceUnlocked] = useState(false);
  const [dateFrom, setDateFrom] = useState(grant.period_start ?? '');
  const [dateTo, setDateTo] = useState(grant.period_end ?? '');
  const [loadingMsg, setLoadingMsg] = useState('');

  const loadData = useCallback(async () => {
    const [reportsRes, reqRes, txTotalRes, pendingRes, questionedRes] = await Promise.all([
      supabase.from('compliance_reports').select('id, created_at').eq('grant_id', grantId).eq('status', 'complete').order('created_at', { ascending: false }),
      supabase.from('grant_requirements').select('id', { count: 'exact', head: true }).eq('grant_id', grantId).eq('is_active', true),
      supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('grant_id', grantId),
      supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('grant_id', grantId).eq('allowability_status', 'pending_review'),
      supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('grant_id', grantId).eq('allowability_status', 'questioned'),
    ]);

    const reports = reportsRes.data ?? [];
    setReadiness({ requirements: reqRes.count ?? 0, transactions: txTotalRes.count ?? 0 });
    setPendingCount(pendingRes.count ?? 0);
    setQuestionedCount(questionedRes.count ?? 0);

    const lastRunAt = reports[0]?.created_at ?? null;
    if (lastRunAt) {
      const { count } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('grant_id', grantId).eq('allowability_status', 'pending_review').gt('created_at', lastRunAt);
      setNewTxCount(count ?? 0);
    } else {
      setNewTxCount(0);
    }

    if (reports.length === 0) { setIsLoading(false); return; }

    const reportIds = reports.map(r => r.id);
    const [findingsRes, ...countResults] = await Promise.all([
      supabase.from('compliance_findings').select('*, finding_transactions(transaction_id, transactions(id, date, description, vendor, amount))').in('report_id', reportIds).order('created_at', { ascending: true }),
      ...reports.map(r => supabase.from('compliance_findings').select('id', { count: 'exact', head: true }).eq('report_id', r.id)),
    ]);

    setAllFindings((findingsRes.data ?? []) as Finding[]);
    setRunLog(reports.map((r, i) => ({ id: r.id, created_at: r.created_at, finding_count: countResults[i].count ?? 0 })));
    setIsLoading(false);
  }, [grantId]);

  useEffect(() => { loadData(); }, [loadData]);

  const lastRunFoundNothing = runLog.length > 0 && runLog[0].finding_count === 0;
  const hasNewTransactions = newTxCount > 0;
  const isLocked = lastRunFoundNothing && !hasNewTransactions && !forceUnlocked;
  const passNumber = runLog.length + 1;

  const PASS_MESSAGES: string[][] = [
    ['Screening transactions against grant requirements...', 'Checking allowable cost categories...', 'Verifying period of performance dates...', 'Scanning for unallowable cost keywords...', 'Analyzing procurement patterns...', 'Generating GAGAS findings...'],
    ['Looking for patterns the first pass may have missed...', 'Analyzing vendor relationships and amounts...', 'Checking for split purchases and threshold manipulation...', 'Deep-diving documentation deficiencies...', 'Cross-referencing against all requirements...', 'Compiling additional findings...'],
    ['Performing final verification on remaining transactions...', 'Cross-checking all unflagged transactions...', 'Verifying complete coverage of compliance requirements...', 'Checking for overlooked edge cases...', 'Confirming analysis completeness...', 'Wrapping up final findings...'],
  ];

  const PASS_FOCUS: string[] = [
    'Scans all pending transactions for obvious compliance violations',
    'Looks deeper for patterns and systemic issues the first pass may have missed',
    'Final verification — cross-checks remaining transactions for any overlooked edge cases',
  ];

  function getButtonLabel() {
    if (runLog.length === 0) return 'Start Compliance Analysis';
    if (hasNewTransactions) return `Run Rollforward — ${newTxCount} New Transaction${newTxCount !== 1 ? 's' : ''}`;
    if (lastRunFoundNothing) return 'Analysis Complete';
    const pass = Math.min(passNumber, 3);
    if (pass === 2) return 'Run Pass 2 — Deeper Analysis';
    if (pass === 3) return 'Run Pass 3 — Final Verification';
    return `Run Pass ${pass} — Additional Check`;
  }

  function getPassFocus() {
    if (hasNewTransactions) return `Testing ${newTxCount} new transaction${newTxCount !== 1 ? 's' : ''} uploaded since the last run`;
    const idx = Math.min(passNumber - 1, PASS_FOCUS.length - 1);
    return PASS_FOCUS[idx] ?? PASS_FOCUS[PASS_FOCUS.length - 1];
  }

  async function handleClearAll() {
    if (runLog.length === 0) return;
    const reportIds = runLog.map(r => r.id);
    // Delete all reports (cascades to findings + finding_transactions)
    await supabase.from('compliance_reports').delete().in('id', reportIds);
    // Reset questioned transactions back to pending_review
    await supabase.from('transactions').update({ allowability_status: 'pending_review' }).eq('grant_id', grantId).eq('allowability_status', 'questioned');
    toast.success('All reports cleared. Transactions reset to pending review.');
    setAllFindings([]);
    setRunLog([]);
    setForceUnlocked(false);
    await loadData();
  }

  async function handleGenerate() {
    if (readiness.requirements === 0) { toast.error('Add at least one requirement before generating.'); return; }
    if (pendingCount === 0 && runLog.length > 0) { toast.error('No pending transactions to analyze. Upload more transactions or check the date range.'); return; }
    if (readiness.transactions === 0) { toast.error('Upload transactions before running a compliance check.'); return; }
    setForceUnlocked(false);
    setIsGenerating(true);

    // Animate loading messages specific to this pass
    const passIdx = Math.min(runLog.length, PASS_MESSAGES.length - 1);
    const msgs = PASS_MESSAGES[passIdx];
    let msgIdx = 0;
    setLoadingMsg(msgs[0]);
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % msgs.length;
      setLoadingMsg(msgs[msgIdx]);
    }, 3500);

    try {
      const res = await fetch('/api/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_id: grantId, date_from: dateFrom || null, date_to: dateTo || null }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Generation failed'); return; }
      const newFindings = json.stats?.findingsGenerated ?? 0;
      if (newFindings === 0) toast.info('No new issues found. Try uploading more transactions or run again.');
      else toast.success(`${newFindings} new finding${newFindings !== 1 ? 's' : ''} identified`);
      await loadData();
    } catch {
      toast.error('Failed to generate. Check your OpenAI API key in .env');
    } finally {
      clearInterval(msgInterval);
      setLoadingMsg('');
      setIsGenerating(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const { data: settings } = await supabase.from('app_settings').select('firm_name, auditor_name').eq('id', 1).single();
      const { pdf } = await import('@react-pdf/renderer');
      const { ComplianceReportPDF } = await import('./compliance-export');
      const consolidated = {
        id: 'final', created_at: new Date().toISOString(),
        overall_score: Math.max(0, 100 - Math.min(100, Math.round(allFindings.length * 4))),
        total_questioned_costs: allFindings.reduce((s, f) => s + (Number(f.questioned_costs) || 0), 0),
        summary: `Final consolidated report. ${allFindings.length} finding${allFindings.length !== 1 ? 's' : ''} identified across ${runLog.length} compliance run${runLog.length !== 1 ? 's' : ''}. Total questioned costs: ${fmt(allFindings.reduce((s, f) => s + (Number(f.questioned_costs) || 0), 0))}.`,
        status: 'complete', compliance_findings: allFindings,
      };
      const blob = await pdf(ComplianceReportPDF({ report: consolidated as any, grant, firmName: settings?.firm_name ?? undefined, auditorName: settings?.auditor_name ?? undefined })).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${grant.name.replace(/[^a-z0-9]/gi, '-')}-final-compliance-report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error(err); toast.error('Export failed'); }
    finally { setIsExporting(false); }
  }

  const totalQC = allFindings.reduce((s, f) => s + (Number(f.questioned_costs) || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Findings accumulate across runs. Keep generating until no new issues are found, then resolve questioned transactions and export the final report.
        </p>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-2">
            {runLog.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />Clear All Reports
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all compliance reports?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {runLog.length} report{runLog.length !== 1 ? 's' : ''} and {allFindings.length} finding{allFindings.length !== 1 ? 's' : ''} for this grant. All questioned transactions will be reset to pending review so you can run a fresh analysis. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleClearAll}>
                      Clear All Reports
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {allFindings.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting || questionedCount > 0} title={questionedCount > 0 ? `Resolve ${questionedCount} questioned transaction${questionedCount !== 1 ? 's' : ''} first` : 'Export final consolidated PDF'}>
                {isExporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exporting...</> : questionedCount > 0 ? <><Lock className="h-4 w-4 mr-2" />Export PDF</> : <><Download className="h-4 w-4 mr-2" />Export Final PDF</>}
              </Button>
            )}
            <Button onClick={handleGenerate} disabled={isGenerating || isLocked} variant={isLocked ? 'secondary' : 'default'} className="min-w-[220px]">
              {isGenerating
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</>
                : isLocked
                  ? <><CheckCircle className="h-4 w-4 mr-2 text-green-600" />Analysis Complete</>
                  : <><RefreshCw className="h-4 w-4 mr-2" />{getButtonLabel()}</>
              }
            </Button>
          </div>
          {isGenerating && loadingMsg ? (
            <p className="text-xs text-muted-foreground italic text-right max-w-xs">{loadingMsg}</p>
          ) : !isLocked && runLog.length >= 0 ? (
            <p className="text-xs text-muted-foreground text-right max-w-xs">{getPassFocus()}</p>
          ) : isLocked ? (
            <button onClick={() => setForceUnlocked(true)} className="text-xs text-muted-foreground hover:underline">
              Run again anyway →
            </button>
          ) : null}
        </div>
      </div>

      {/* Date range picker */}
      <div className="flex items-center gap-3 bg-muted/30 border rounded-lg px-4 py-2.5">
        <span className="text-xs font-medium text-muted-foreground shrink-0">Test period:</span>
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-7 text-xs w-36" />
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-7 text-xs w-36" />
        </div>
        {(dateFrom !== (grant.period_start ?? '') || dateTo !== (grant.period_end ?? '')) && (
          <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => { setDateFrom(grant.period_start ?? ''); setDateTo(grant.period_end ?? ''); }}>
            Reset ×
          </Button>
        )}
      </div>

      {/* Banners */}
      {hasNewTransactions && runLog.length > 0 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-700">
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span><strong>{newTxCount}</strong> new transaction{newTxCount !== 1 ? 's' : ''} uploaded since last run — rollforward testing available.</span>
        </div>
      )}
      {questionedCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span><strong>{questionedCount}</strong> transaction{questionedCount !== 1 ? 's' : ''} marked Questioned — review with the nonprofit and mark each as <strong>Cleared</strong> or <strong>Disallowed</strong> to unlock the final export.</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : runLog.length === 0 ? (
        <Card className="p-10">
          <div className="flex flex-col items-center text-center mb-6">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium mb-1">No compliance checks run yet</p>
            <p className="text-xs text-muted-foreground">Complete the checklist below then generate your first report.</p>
          </div>
          <div className="space-y-2 max-w-sm mx-auto">
            {[
              { done: readiness.requirements > 0, text: readiness.requirements > 0 ? `${readiness.requirements} requirement${readiness.requirements !== 1 ? 's' : ''} defined` : 'Add compliance requirements' },
              { done: readiness.transactions > 0, text: readiness.transactions > 0 ? `${readiness.transactions} transaction${readiness.transactions !== 1 ? 's' : ''} uploaded` : 'Upload transactions' },
            ].map((item, i) => (
              <div key={i} className={`flex items-center gap-3 text-sm px-3 py-2 rounded-md ${item.done ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                <span>{item.done ? '✓' : '○'}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-5">
              <div className="text-3xl font-bold text-red-600">{fmt(totalQC)}</div>
              <div className="text-sm text-muted-foreground mt-1">Total Questioned Costs</div>
            </Card>
            <Card className="p-5">
              <div className="text-3xl font-bold">{allFindings.length}</div>
              <div className="text-sm text-muted-foreground mt-1">Total Findings</div>
              <div className="text-xs text-muted-foreground">{pendingCount} transaction{pendingCount !== 1 ? 's' : ''} pending review</div>
            </Card>
            <Card className="p-5">
              <div className="text-sm font-medium mb-2">Run History</div>
              <div className="space-y-1.5 max-h-28 overflow-y-auto">
                {[...runLog].reverse().map((run, i) => {
                  const passNum = runLog.length - i;
                  return (
                    <div key={run.id} className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-muted rounded px-1 font-mono text-muted-foreground">P{passNum}</span>
                        <span className="text-muted-foreground">{new Date(run.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <span className={`font-medium ${run.finding_count === 0 ? 'text-green-600' : 'text-orange-600'}`}>
                        {run.finding_count === 0 ? '✓ Clean' : `+${run.finding_count}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Findings */}
          {allFindings.length > 0 ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Schedule of Findings — Cumulative ({allFindings.length})</h3>
              {[...allFindings].reverse().map(f => {
                const style = severityStyles[f.severity] ?? severityStyles.other;
                const txs = f.finding_transactions?.map(ft => ft.transactions).filter(Boolean) ?? [];
                const runDate = runLog.find(r => r.id === f.report_id)?.created_at;
                return (
                  <Card key={f.id} className={`border-l-4 ${style.border}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm">{f.finding_ref}</span>
                          <Badge className={style.badge}>{style.label}</Badge>
                          {f.category && <Badge variant="outline" className="text-xs">{f.category}</Badge>}
                          {f.is_repeat && <Badge className="bg-purple-100 text-purple-700 text-xs">Repeat</Badge>}
                          {runDate && <span className="text-xs text-muted-foreground border-l pl-2 ml-1">Found {new Date(runDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                        </div>
                        {f.questioned_costs > 0 && (
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-red-600">{fmt(f.questioned_costs)}</div>
                            <div className="text-xs text-muted-foreground">questioned</div>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {f.condition_text && <div><p className="text-xs font-semibold uppercase text-muted-foreground mb-0.5">Condition</p><p className="text-sm">{f.condition_text}</p></div>}
                      {f.criteria && <div><p className="text-xs font-semibold uppercase text-muted-foreground mb-0.5">Criteria</p><p className="text-sm bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded px-3 py-2">{f.criteria}</p></div>}
                      {f.cause && <div><p className="text-xs font-semibold uppercase text-muted-foreground mb-0.5">Cause</p><p className="text-sm">{f.cause}</p></div>}
                      {f.effect && <div><p className="text-xs font-semibold uppercase text-muted-foreground mb-0.5">Effect</p><p className="text-sm">{f.effect}</p></div>}
                      {f.recommendation && <div><p className="text-xs font-semibold uppercase text-muted-foreground mb-0.5">Recommendation</p><p className="text-sm">{f.recommendation}</p></div>}
                      {txs.length > 0 && (
                        <div>
                          <Separator className="my-2" />
                          <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Cited Transactions ({txs.length})</p>
                          <div className="space-y-1">
                            {txs.map(t => (
                              <div key={t.id} className="flex items-center gap-3 text-xs bg-muted/50 rounded px-2.5 py-1.5 font-mono">
                                <span className="text-muted-foreground">{t.date ?? '—'}</span>
                                <span className="flex-1 truncate">{t.description ?? '—'}</span>
                                <span className="text-muted-foreground">{t.vendor ?? '—'}</span>
                                <span className="font-semibold">{t.amount != null ? fmt(t.amount) : '—'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
              <p className="text-sm font-medium text-green-600">No findings identified yet</p>
              <p className="text-xs text-muted-foreground mt-1">Run the compliance check to begin analyzing transactions.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
