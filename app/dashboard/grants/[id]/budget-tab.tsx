"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const CATEGORIES = [
  { key: 'personnel', label: 'Personnel (Salaries & Wages)' },
  { key: 'fringe', label: 'Fringe Benefits' },
  { key: 'travel', label: 'Travel' },
  { key: 'equipment', label: 'Equipment (≥$5,000)' },
  { key: 'supplies', label: 'Supplies & Materials' },
  { key: 'contractual', label: 'Contractual / Consultants' },
  { key: 'other_direct', label: 'Other Direct Costs' },
  { key: 'indirect', label: 'Indirect / F&A' },
];

type BudgetRow = { category: string; approved: number; actual: number };

export default function BudgetTab({ grantId }: { grantId: string }) {
  const [rows, setRows] = useState<BudgetRow[]>(CATEGORIES.map(c => ({ category: c.key, approved: 0, actual: 0 })));
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const [budgetRes, txRes] = await Promise.all([
        supabase.from('budget_line_items').select('*').eq('grant_id', grantId),
        supabase.from('transactions').select('budget_category, amount').eq('grant_id', grantId),
      ]);

      const approved: Record<string, number> = {};
      for (const b of budgetRes.data ?? []) approved[b.category] = Number(b.approved_amount);

      const actual: Record<string, number> = {};
      for (const t of txRes.data ?? []) {
        if (t.budget_category) actual[t.budget_category] = (actual[t.budget_category] ?? 0) + Number(t.amount ?? 0);
      }

      setRows(CATEGORIES.map(c => ({ category: c.key, approved: approved[c.key] ?? 0, actual: actual[c.key] ?? 0 })));
      setIsLoading(false);
    }
    load();
  }, [grantId]);

  async function handleSave() {
    setSaving(true);
    const upserts = rows.map(r => ({ grant_id: grantId, category: r.category, approved_amount: r.approved }));
    const { error } = await supabase.from('budget_line_items').upsert(upserts, { onConflict: 'grant_id,category' });
    setSaving(false);
    if (error) { toast.error('Failed to save budget'); return; }
    toast.success('Budget saved');
  }

  const totalApproved = rows.reduce((s, r) => s + r.approved, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const varianceColor = (approved: number, actual: number) => {
    if (approved === 0) return '';
    const pct = actual / approved;
    if (pct > 1) return 'text-red-600 font-semibold';
    if (pct > 0.9) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Enter approved budget amounts per the grant award. Actual spending is pulled from uploaded transactions.
        </p>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Budget'}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Object Class</TableHead>
              <TableHead className="text-right">Approved Amount</TableHead>
              <TableHead className="text-right">Actual Spent</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="text-right">% Used</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const label = CATEGORIES[i].label;
              const remaining = row.approved - row.actual;
              const pctUsed = row.approved > 0 ? Math.round((row.actual / row.approved) * 100) : null;
              return (
                <TableRow key={row.category}>
                  <TableCell className="font-medium text-sm">{label}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end">
                      <span className="text-muted-foreground mr-1">$</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.approved || ''}
                        onChange={e => setRows(rs => rs.map(r => r.category === row.category ? { ...r, approved: parseFloat(e.target.value) || 0 } : r))}
                        className="w-32 text-right h-7 text-sm"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm">{fmt(row.actual)}</TableCell>
                  <TableCell className={`text-right text-sm ${varianceColor(row.approved, row.actual)}`}>
                    {row.approved > 0 ? fmt(remaining) : '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {pctUsed !== null ? (
                      <Badge className={pctUsed > 100 ? 'bg-red-100 text-red-700' : pctUsed > 90 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}>
                        {pctUsed}%
                      </Badge>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableBody>
            <TableRow className="border-t-2 font-semibold bg-muted/30">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">{fmt(totalApproved)}</TableCell>
              <TableCell className="text-right">{fmt(totalActual)}</TableCell>
              <TableCell className={`text-right ${totalActual > totalApproved ? 'text-red-600' : ''}`}>{fmt(totalApproved - totalActual)}</TableCell>
              <TableCell className="text-right">
                {totalApproved > 0 ? `${Math.round((totalActual / totalApproved) * 100)}%` : '—'}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground flex gap-4">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Under 90% spent</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />90–100% spent</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Over budget</span>
      </p>
    </div>
  );
}
