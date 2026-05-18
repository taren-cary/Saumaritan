"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CircleDollarSign, FileText, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const CATEGORY_LABELS: Record<string, string> = {
  personnel: 'Personnel', fringe: 'Fringe', travel: 'Travel',
  equipment: 'Equipment', supplies: 'Supplies', contractual: 'Contractual',
  other_direct: 'Other Direct', indirect: 'Indirect',
};

const severityStyles: Record<string, { badge: string; label: string }> = {
  material_weakness: { badge: 'bg-red-100 text-red-700', label: 'Material Weakness' },
  significant_deficiency: { badge: 'bg-orange-100 text-orange-700', label: 'Sig. Deficiency' },
  material_noncompliance: { badge: 'bg-yellow-100 text-yellow-700', label: 'Noncompliance' },
  other: { badge: 'bg-blue-100 text-blue-700', label: 'Other' },
};

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

type SpendingRow = { name: string; amount: number };
type ComplianceRow = { name: string; score: number };
type RecentFinding = { id: string; finding_ref: string; severity: string; category: string | null; questioned_costs: number; grantName: string };

export default function DashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [totalTx, setTotalTx] = useState(0);
  const [flaggedTx, setFlaggedTx] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [activeGrants, setActiveGrants] = useState(0);
  const [questionedCosts, setQuestionedCosts] = useState(0);
  const [spending, setSpending] = useState<SpendingRow[]>([]);
  const [compliance, setCompliance] = useState<ComplianceRow[]>([]);
  const [recentFindings, setRecentFindings] = useState<RecentFinding[]>([]);

  useEffect(() => {
    async function load() {
      const [txRes, grantRes, findingsRes, spendingRes, complianceRes] = await Promise.all([
        supabase.from('transactions').select('amount, allowability_status'),
        supabase.from('grants').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('compliance_findings').select('id, finding_ref, severity, category, questioned_costs, compliance_reports(grant_id, grants(name))').order('created_at', { ascending: false }).limit(6),
        supabase.from('transactions').select('budget_category, amount').not('budget_category', 'is', null),
        supabase.from('compliance_reports').select('grant_id, overall_score, grants(name)').eq('status', 'complete').order('created_at', { ascending: false }),
      ]);

      const txData = txRes.data ?? [];
      setTotalTx(txData.length);
      setFlaggedTx(txData.filter(t => t.allowability_status === 'questioned' || t.allowability_status === 'disallowed').length);
      setTotalAmount(txData.reduce((s, t) => s + (Number(t.amount) || 0), 0));
      setActiveGrants(grantRes.count ?? 0);

      // Spending by category
      const spendMap: Record<string, number> = {};
      for (const t of spendingRes.data ?? []) {
        if (t.budget_category) spendMap[t.budget_category] = (spendMap[t.budget_category] ?? 0) + (Number(t.amount) || 0);
      }
      setSpending(
        Object.entries(spendMap)
          .map(([k, v]) => ({ name: CATEGORY_LABELS[k] ?? k, amount: v }))
          .filter(r => r.amount > 0)
          .sort((a, b) => b.amount - a.amount)
      );

      // Latest compliance score per grant
      const seen = new Set<string>();
      const rows: ComplianceRow[] = [];
      for (const r of complianceRes.data ?? []) {
        if (!seen.has(r.grant_id)) {
          seen.add(r.grant_id);
          const name = (r as any).grants?.name ?? 'Unknown';
          rows.push({ name: name.length > 16 ? name.slice(0, 14) + '…' : name, score: r.overall_score ?? 0 });
        }
      }
      setCompliance(rows);

      // Questioned costs from findings
      const fData = findingsRes.data ?? [];
      setQuestionedCosts(fData.reduce((s, f) => s + (Number(f.questioned_costs) || 0), 0));

      // Recent findings
      setRecentFindings(fData.map((f: any) => ({
        id: f.id,
        finding_ref: f.finding_ref,
        severity: f.severity,
        category: f.category,
        questioned_costs: Number(f.questioned_costs) || 0,
        grantName: f.compliance_reports?.grants?.name ?? '—',
      })));

      setIsLoading(false);
    }
    load();
  }, []);

  const statCards = [
    { label: 'Total Transactions', value: isLoading ? '—' : totalTx.toLocaleString(), icon: CircleDollarSign, iconColor: 'text-muted-foreground', href: '/dashboard/transactions' },
    { label: 'Flagged Transactions', value: isLoading ? '—' : flaggedTx.toLocaleString(), icon: AlertTriangle, iconColor: 'text-destructive', href: '/dashboard/transactions?status=questioned' },
    { label: 'Total Spending', value: isLoading ? '—' : fmt(totalAmount), icon: TrendingUp, iconColor: 'text-muted-foreground', href: null },
    { label: 'Active Grants', value: isLoading ? '—' : activeGrants.toLocaleString(), icon: FileText, iconColor: 'text-blue-600', href: '/dashboard/organizations' },
    { label: 'Questioned Costs', value: isLoading ? '—' : fmt(questionedCosts), icon: AlertTriangle, iconColor: 'text-red-600', href: '/dashboard/transactions?status=questioned' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>

      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {statCards.map(card => (
          <Card
            key={card.label}
            className={card.href ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
            onClick={() => card.href && router.push(card.href)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">{card.label}</CardTitle>
              <card.icon className={`h-4 w-4 shrink-0 ${card.iconColor}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      {(spending.length > 0 || compliance.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">

          {spending.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Spending by Budget Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(180, spending.length * 32)}>
                  <BarChart data={spending} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                    />
                    <YAxis type="category" dataKey="name" width={82} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [fmt(Number(v)), 'Spent']} />
                    <Bar dataKey="amount" fill="#1d4e89" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {compliance.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Compliance Score by Grant</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={compliance} margin={{ left: 0, right: 8, top: 4, bottom: compliance.some(r => r.name.length > 8) ? 32 : 8 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={compliance.length > 3 ? -25 : 0} textAnchor={compliance.length > 3 ? 'end' : 'middle'} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => [`${v}/100`, 'Score']} />
                    <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                      {compliance.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.score >= 80 ? '#16a34a' : entry.score >= 60 ? '#ca8a04' : '#dc2626'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground justify-center">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600 inline-block" />80–100</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-600 inline-block" />60–79</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600 inline-block" />0–59</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent findings */}
      {recentFindings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Recent Findings</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-0">
              {recentFindings.map(f => {
                const style = severityStyles[f.severity] ?? severityStyles.other;
                return (
                  <div key={f.id} className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-mono text-xs text-muted-foreground shrink-0 w-16">{f.finding_ref}</span>
                      <Badge className={`text-xs shrink-0 ${style.badge}`}>{style.label}</Badge>
                      <span className="text-xs text-muted-foreground truncate hidden sm:block">{f.category ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs text-muted-foreground hidden md:block max-w-[140px] truncate">{f.grantName}</span>
                      {f.questioned_costs > 0 && (
                        <span className="text-sm font-semibold text-red-600 whitespace-nowrap">{fmt(f.questioned_costs)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {!isLoading && flaggedTx > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {flaggedTx} transaction{flaggedTx !== 1 ? 's' : ''} flagged by compliance reports need review.{' '}
            <button onClick={() => router.push('/dashboard/transactions?status=questioned')} className="underline font-medium hover:no-underline">
              View flagged transactions →
            </button>
          </AlertDescription>
        </Alert>
      )}
      {!isLoading && totalTx === 0 && (
        <Alert>
          <AlertDescription>
            No transactions yet.{' '}
            <button onClick={() => router.push('/dashboard/organizations')} className="underline font-medium hover:no-underline">
              Go to Organizations to get started →
            </button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
