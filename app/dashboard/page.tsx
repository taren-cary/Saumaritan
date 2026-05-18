"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CircleDollarSign, FileText, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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
  const [recentFindings, setRecentFindings] = useState<RecentFinding[]>([]);

  useEffect(() => {
    async function load() {
      const [txRes, grantRes, findingsRes, spendingRes] = await Promise.all([
        supabase.from('transactions').select('amount, allowability_status'),
        supabase.from('grants').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('compliance_findings').select('id, finding_ref, severity, category, questioned_costs, compliance_reports(grant_id, grants(name))').order('created_at', { ascending: false }).limit(6),
        supabase.from('transactions').select('budget_category, amount').not('budget_category', 'is', null),
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

      {/* Spending by category chart */}
      {spending.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Spending by Budget Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(180, spending.length * 32)}>
              <BarChart data={spending} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} />
                <YAxis type="category" dataKey="name" width={82} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [fmt(Number(v)), 'Spent']} />
                <Bar dataKey="amount" fill="#1d4e89" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
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
