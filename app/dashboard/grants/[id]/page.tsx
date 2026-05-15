"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import RequirementsTab from './requirements-tab';
import BudgetTab from './budget-tab';
import TransactionsTab from './transactions-tab';
import ComplianceTab from './compliance-tab';

type Grant = {
  id: string;
  name: string;
  grant_number: string | null;
  grant_type: string;
  awarding_agency: string | null;
  funder_name: string | null;
  award_amount: number | null;
  period_start: string | null;
  period_end: string | null;
  status: string;
  cfda_number: string | null;
  organizations: { id: string; name: string } | null;
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-gray-100 text-gray-700',
  closed: 'bg-red-100 text-red-700',
};

export default function GrantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [grant, setGrant] = useState<Grant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('grants')
      .select('*, organizations(id, name)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setIsLoading(false); return; }
        setGrant(data as Grant);
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;
  if (!grant) return <div className="text-sm text-destructive p-4">Grant not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => router.push('/dashboard/organizations')} className="hover:underline">Organizations</button>
        <span>/</span>
        <button onClick={() => router.push(`/dashboard/organizations/${grant.organizations?.id}`)} className="hover:underline">
          {grant.organizations?.name}
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">{grant.name}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight">{grant.name}</h2>
            <Badge className={statusColors[grant.status] ?? ''}>{grant.status}</Badge>
          </div>
          <div className="flex gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
            {grant.awarding_agency && <span>{grant.awarding_agency}</span>}
            {grant.cfda_number && <span>CFDA {grant.cfda_number}</span>}
            {grant.grant_number && <span>#{grant.grant_number}</span>}
            {grant.period_start && grant.period_end && <span>{grant.period_start} – {grant.period_end}</span>}
            {grant.award_amount && (
              <span className="font-semibold text-foreground">
                ${Number(grant.award_amount).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="requirements">
        <TabsList>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="compliance">Compliance Report</TabsTrigger>
        </TabsList>

        <TabsContent value="requirements" className="mt-6">
          <RequirementsTab grantId={id} />
        </TabsContent>

        <TabsContent value="budget" className="mt-6">
          <BudgetTab grantId={id} />
        </TabsContent>

        <TabsContent value="transactions" className="mt-6">
          <TransactionsTab grantId={id} />
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          <ComplianceTab grantId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
