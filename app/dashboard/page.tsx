"use client";

import { useEffect, useState } from 'react';
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
  const [stats, setStats] = useState<Stats>({
    totalTransactions: 0,
    flaggedTransactions: 0,
    totalAmount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, risk_level');

      if (!error && data) {
        setStats({
          totalTransactions: data.length,
          flaggedTransactions: data.filter((t) => t.risk_level === 'high').length,
          totalAmount: data.reduce((sum, t) => sum + (t.amount ?? 0), 0),
        });
      }
      setIsLoading(false);
    }
    fetchStats();
  }, []);

  const fmt = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '—' : stats.totalTransactions}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk Transactions</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '—' : stats.flaggedTransactions}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '—' : fmt(stats.totalAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {!isLoading && stats.flaggedTransactions > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {stats.flaggedTransactions} high-risk transaction
            {stats.flaggedTransactions !== 1 ? 's' : ''} need review. Check the
            Transactions page for details.
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && stats.totalTransactions === 0 && (
        <Alert>
          <AlertDescription>
            No transactions yet. Go to the Transactions page to upload a CSV or XLSX file.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
