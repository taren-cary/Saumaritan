"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, Download, FileText, Loader2, RefreshCw, Trash2 } from 'lucide-react';

type Transaction = { id: string; date: string | null; description: string | null; vendor: string | null; amount: number | null };
type Finding = {
  id: string;
  finding_ref: string;
  severity: string;
  category: string | null;
  condition_text: string | null;
  criteria: string | null;
  cause: string | null;
  effect: string | null;
  recommendation: string | null;
  questioned_costs: number;
  is_repeat: boolean;
  finding_transactions: { transaction_id: string; transactions: Transaction }[];
};
type Report = {
  id: string;
  created_at: string;
  overall_score: number;
  total_questioned_costs: number;
  summary: string | null;
  status: string;
  compliance_findings: Finding[];
};

const severityStyles: Record<string, { badge: string; border: string; label: string }> = {
  material_weakness: { badge: 'bg-red-100 text-red-700', border: 'border-red-300', label: 'Material Weakness' },
  significant_deficiency: { badge: 'bg-orange-100 text-orange-700', border: 'border-orange-300', label: 'Significant Deficiency' },
  material_noncompliance: { badge: 'bg-yellow-100 text-yellow-700', border: 'border-yellow-300', label: 'Material Noncompliance' },
  other: { badge: 'bg-blue-100 text-blue-700', border: 'border-blue-300', label: 'Other Finding' },
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600';
  const label = score >= 80 ? 'Compliant' : score >= 60 ? 'Needs Attention' : 'Non-Compliant';
  return (
    <div className="flex flex-col items-center">
      <div className={`text-5xl font-bold ${color}`}>{score}</div>
      <div className={`text-sm font-medium ${color}`}>{label}</div>
      <div className="text-xs text-muted-foreground">Compliance Score</div>
    </div>
  );
}

interface Grant {
  name: string; grant_number: string | null; awarding_agency: string | null;
  cfda_number: string | null; award_amount: number | null;
  period_start: string | null; period_end: string | null;
  organizations: { name: string } | null;
}

export default function ComplianceTab({ grantId, grant }: { grantId: string; grant: Grant }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  async function fetchReports() {
    const { data } = await supabase
      .from('compliance_reports')
      .select(`
        *,
        compliance_findings (
          *,
          finding_transactions (
            transaction_id,
            transactions ( id, date, description, vendor, amount )
          )
        )
      `)
      .eq('grant_id', grantId)
      .eq('status', 'complete')
      .order('created_at', { ascending: false });
    const list = (data ?? []) as Report[];
    setReports(list);
    if (list.length > 0 && !selectedReport) setSelectedReport(list[0]);
    setIsLoading(false);
  }

  useEffect(() => { fetchReports(); }, [grantId]);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_id: grantId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Generation failed');
        return;
      }
      toast.success('Compliance report generated');
      await fetchReports();
    } catch {
      toast.error('Failed to generate report. Check your OpenAI API key in .env');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDelete(reportId: string) {
    const { error } = await supabase.from('compliance_reports').delete().eq('id', reportId);
    if (error) { toast.error('Failed to delete report'); return; }
    toast.success('Report deleted');
    const updated = reports.filter(r => r.id !== reportId);
    setReports(updated);
    setSelectedReport(updated[0] ?? null);
  }

  async function handleExport() {
    if (!selectedReport) return;
    setIsExporting(true);
    try {
      const { data: settings } = await supabase.from('app_settings').select('firm_name, auditor_name').eq('id', 1).single();
      const { pdf } = await import('@react-pdf/renderer');
      const { ComplianceReportPDF } = await import('./compliance-export');
      const blob = await pdf(
        ComplianceReportPDF({
          report: selectedReport,
          grant,
          firmName: settings?.firm_name ?? undefined,
          auditorName: settings?.auditor_name ?? undefined,
        })
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date(selectedReport.created_at).toISOString().split('T')[0];
      a.download = `${grant.name.replace(/[^a-z0-9]/gi, '-')}-compliance-${dateStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  }

  const report = selectedReport;
  const findings = report?.compliance_findings ?? [];
  const totalQC = findings.reduce((s, f) => s + (Number(f.questioned_costs) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            AI analyzes all transactions against grant requirements and generates GAGAS-compliant findings with citations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedReport && (
            <>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
                {isExporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exporting...</> : <><Download className="h-4 w-4 mr-2" />Export PDF</>}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this report?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the compliance report and all its findings. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDelete(selectedReport.id)}>
                      Delete Report
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><RefreshCw className="h-4 w-4 mr-2" />Generate Report</>}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : reports.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No reports yet. Add requirements and upload transactions, then generate your first report.</p>
        </Card>
      ) : (
        <>
          {reports.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {reports.map(r => (
                <Button
                  key={r.id}
                  size="sm"
                  variant={selectedReport?.id === r.id ? 'secondary' : 'outline'}
                  onClick={() => setSelectedReport(r)}
                >
                  {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Button>
              ))}
            </div>
          )}

          {report && (
            <div className="space-y-6">
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-6 flex items-center justify-center">
                  <ScoreRing score={report.overall_score ?? 0} />
                </Card>
                <Card className="p-6">
                  <div className="text-2xl font-bold text-red-600">
                    ${Number(report.total_questioned_costs || totalQC).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Questioned Costs</div>
                  <div className="text-xs text-muted-foreground mt-1">{findings.length} finding{findings.length !== 1 ? 's' : ''}</div>
                </Card>
                <Card className="p-6">
                  <div className="text-sm font-medium mb-2">Finding Summary</div>
                  {['material_weakness','significant_deficiency','material_noncompliance','other'].map(s => {
                    const count = findings.filter(f => f.severity === s).length;
                    if (!count) return null;
                    return (
                      <div key={s} className="flex items-center justify-between text-xs mb-1">
                        <Badge className={`${severityStyles[s]?.badge} text-xs`}>{severityStyles[s]?.label}</Badge>
                        <span className="font-medium">{count}</span>
                      </div>
                    );
                  })}
                  {findings.length === 0 && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" />No findings</p>}
                </Card>
              </div>

              {report.summary && (
                <Card className="p-4 bg-muted/30">
                  <p className="text-sm">{report.summary}</p>
                </Card>
              )}

              {/* Findings */}
              {findings.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Schedule of Findings</h3>
                  {findings.map((f) => {
                    const style = severityStyles[f.severity] ?? severityStyles.other;
                    const txs = f.finding_transactions?.map(ft => ft.transactions).filter(Boolean) ?? [];
                    return (
                      <Card key={f.id} className={`border-l-4 ${style.border}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-sm">{f.finding_ref}</span>
                              <Badge className={style.badge}>{style.label}</Badge>
                              {f.category && <Badge variant="outline" className="text-xs">{f.category}</Badge>}
                              {f.is_repeat && <Badge className="bg-purple-100 text-purple-700 text-xs">Repeat Finding</Badge>}
                            </div>
                            {f.questioned_costs > 0 && (
                              <div className="text-right shrink-0">
                                <div className="text-sm font-bold text-red-600">
                                  ${Number(f.questioned_costs).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="text-xs text-muted-foreground">questioned</div>
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-0">
                          {f.condition_text && (
                            <div>
                              <p className="text-xs font-semibold uppercase text-muted-foreground mb-0.5">Condition</p>
                              <p className="text-sm">{f.condition_text}</p>
                            </div>
                          )}
                          {f.criteria && (
                            <div>
                              <p className="text-xs font-semibold uppercase text-muted-foreground mb-0.5">Criteria</p>
                              <p className="text-sm bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded px-3 py-2">
                                {f.criteria}
                              </p>
                            </div>
                          )}
                          {f.cause && (
                            <div>
                              <p className="text-xs font-semibold uppercase text-muted-foreground mb-0.5">Cause</p>
                              <p className="text-sm">{f.cause}</p>
                            </div>
                          )}
                          {f.effect && (
                            <div>
                              <p className="text-xs font-semibold uppercase text-muted-foreground mb-0.5">Effect</p>
                              <p className="text-sm">{f.effect}</p>
                            </div>
                          )}
                          {f.recommendation && (
                            <div>
                              <p className="text-xs font-semibold uppercase text-muted-foreground mb-0.5">Recommendation</p>
                              <p className="text-sm">{f.recommendation}</p>
                            </div>
                          )}
                          {txs.length > 0 && (
                            <div>
                              <Separator className="my-2" />
                              <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
                                Cited Transactions ({txs.length})
                              </p>
                              <div className="space-y-1">
                                {txs.map(t => (
                                  <div key={t.id} className="flex items-center gap-3 text-xs bg-muted/50 rounded px-2.5 py-1.5 font-mono">
                                    <span className="text-muted-foreground">{t.date ?? '—'}</span>
                                    <span className="flex-1 truncate">{t.description ?? '—'}</span>
                                    <span className="text-muted-foreground">{t.vendor ?? '—'}</span>
                                    <span className="font-semibold">
                                      {t.amount != null ? `$${Number(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                                    </span>
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
              )}

              {findings.length === 0 && (
                <Card className="p-8 text-center">
                  <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
                  <p className="text-sm font-medium text-green-600">No findings identified</p>
                  <p className="text-xs text-muted-foreground mt-1">All reviewed transactions appear compliant with the defined grant requirements.</p>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
