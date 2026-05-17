"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, CircleDollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Stats = {
  totalTransactions: number;
  flaggedTransactions: number;
  totalAmount: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ totalTransactions: 0, flaggedTransactions: 0, totalAmount: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const { data, error } = await supabase.from('transactions').select('amount, allowability_status');
      if (!error && data) {
        setStats({
          totalTransactions: data.length,
          flaggedTransactions: data.filter((t) => t.allowability_status === 'questioned' || t.allowability_status === 'disallowed').length,
          totalAmount: data.reduce((sum, t) => sum + (t.amount ?? 0), 0),
        });
      }
      setIsLoading(false);
    }
    fetchStats();
  }, []);

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>

      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push('/dashboard/transactions')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '—' : stats.totalTransactions}</div>
            <p className="text-xs text-muted-foreground mt-1">Click to view all</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push('/dashboard/transactions?status=questioned')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Flagged Transactions</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '—' : stats.flaggedTransactions}</div>
            <p className="text-xs text-muted-foreground mt-1">Click to review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '—' : fmt(stats.totalAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all grants</p>
          </CardContent>
        </Card>
      </div>

      {!isLoading && stats.flaggedTransactions > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {stats.flaggedTransactions} transaction{stats.flaggedTransactions !== 1 ? 's' : ''} flagged by compliance reports need review.{' '}
            <button
              onClick={() => router.push('/dashboard/transactions?status=questioned')}
              className="underline font-medium hover:no-underline"
            >
              View flagged transactions →
            </button>
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && stats.totalTransactions === 0 && (
        <Alert>
          <AlertDescription>
            No transactions yet.{' '}
            <button
              onClick={() => router.push('/dashboard/organizations')}
              className="underline font-medium hover:no-underline"
            >
              Go to Organizations to get started →
            </button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
