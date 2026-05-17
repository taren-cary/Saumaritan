"use client";

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

type Transaction = {
  id: string;
  date: string | null;
  description: string | null;
  amount: number | null;
  vendor: string | null;
  budget_category: string | null;
  risk_level: string | null;
  allowability_status: string | null;
  source_file: string | null;
  grant_id: string | null;
  grants: { name: string; organizations: { name: string } } | null;
};

type Grant = { id: string; name: string; organization_id: string; organizations: { name: string } };

const statusStyles: Record<string, string> = {
  pending_review: 'bg-gray-100 text-gray-600',
  questioned: 'bg-yellow-100 text-yellow-700',
  cleared: 'bg-green-100 text-green-700',
  disallowed: 'bg-red-100 text-red-700',
};

function TransactionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [grantFilter, setGrantFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'all');

  useEffect(() => {
    async function load() {
      const [txRes, grantRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('id,date,description,amount,vendor,budget_category,risk_level,allowability_status,source_file,grant_id,grants(name,organizations(name))')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('grants')
          .select('id,name,organization_id,organizations(name)')
          .order('name'),
      ]);
      if (txRes.error) toast.error('Failed to load transactions');
      setTransactions((txRes.data ?? []) as unknown as Transaction[]);
      setGrants((grantRes.data ?? []) as unknown as Grant[]);
      setIsLoading(false);
    }
    load();
  }, []);

  const filtered = transactions.filter(t => {
    if (grantFilter !== 'all' && t.grant_id !== grantFilter) return false;
    if (statusFilter !== 'all' && t.allowability_status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.description?.toLowerCase().includes(q) ||
      t.vendor?.toLowerCase().includes(q) ||
      t.source_file?.toLowerCase().includes(q)
    );
  });

  const total = filtered.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">All Transactions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            To upload transactions, go to an organization → grant → Transactions tab.
          </p>
        </div>
        {statusFilter !== 'all' && (
          <button
            onClick={() => setStatusFilter('all')}
            className="text-xs text-muted-foreground hover:underline"
          >
            Clear filter ×
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search transactions..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="questioned">Questioned</SelectItem>
            <SelectItem value="cleared">Cleared</SelectItem>
            <SelectItem value="disallowed">Disallowed</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
          </SelectContent>
        </Select>
        <Select value={grantFilter} onValueChange={setGrantFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All grants" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grants</SelectItem>
            {grants.map(g => (
              <SelectItem key={g.id} value={g.id}>
                {g.organizations?.name ? `${g.organizations.name} — ` : ''}{g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered.length > 0 && (
          <div className="flex items-center text-sm text-muted-foreground">
            {filtered.length} rows · ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        )}
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {search || grantFilter !== 'all' ? 'No transactions match your filters.' : 'No transactions yet.'}
            </p>
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/organizations')}>
              Go to Organizations to upload
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Grant</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">{t.date ?? '—'}</TableCell>
                  <TableCell className="max-w-[160px] truncate text-sm">{t.description ?? '—'}</TableCell>
                  <TableCell className="text-sm">{t.vendor ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {t.amount != null ? `$${Number(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                  </TableCell>
                  <TableCell>
                    {t.grants ? (
                      <button
                        onClick={() => router.push(`/dashboard/grants/${t.grant_id}`)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        {t.grants.name}
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">No grant</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.budget_category ?? '—'}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${statusStyles[t.allowability_status ?? ''] ?? ''}`}>
                      {t.allowability_status?.replace('_', ' ') ?? 'unknown'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}>
      <TransactionsContent />
    </Suspense>
  );
}
