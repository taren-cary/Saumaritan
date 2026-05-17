"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import RequirementsTab from './requirements-tab';
import BudgetTab from './budget-tab';
import TransactionsTab from './transactions-tab';
import ComplianceTab from './compliance-tab';

type Grant = {
  id: string; name: string; grant_number: string | null; grant_type: string;
  awarding_agency: string | null; funder_name: string | null; award_amount: number | null;
  period_start: string | null; period_end: string | null; status: string;
  cfda_number: string | null; indirect_cost_rate: number | null; indirect_cost_type: string | null;
  matching_required: boolean; match_percentage: number | null; reporting_frequency: string | null; notes: string | null;
  organizations: { id: string; name: string } | null;
};

type Counts = { requirements: number; transactions: number };

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
  const [counts, setCounts] = useState<Counts>({ requirements: 0, transactions: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function loadGrant() {
    const [grantRes, reqRes, txRes] = await Promise.all([
      supabase.from('grants').select('*, organizations(id, name)').eq('id', id).single(),
      supabase.from('grant_requirements').select('id', { count: 'exact', head: true }).eq('grant_id', id).eq('is_active', true),
      supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('grant_id', id),
    ]);
    if (grantRes.error || !grantRes.data) { setIsLoading(false); return; }
    setGrant(grantRes.data as Grant);
    setCounts({ requirements: reqRes.count ?? 0, transactions: txRes.count ?? 0 });
    setIsLoading(false);
  }

  useEffect(() => { loadGrant(); }, [id]);

  function openEdit() {
    if (!grant) return;
    setEditForm({
      name: grant.name,
      grant_number: grant.grant_number ?? '',
      grant_type: grant.grant_type,
      awarding_agency: grant.awarding_agency ?? '',
      cfda_number: grant.cfda_number ?? '',
      funder_name: grant.funder_name ?? '',
      award_amount: grant.award_amount?.toString() ?? '',
      period_start: grant.period_start ?? '',
      period_end: grant.period_end ?? '',
      indirect_cost_rate: grant.indirect_cost_rate?.toString() ?? '',
      indirect_cost_type: grant.indirect_cost_type ?? '',
      matching_required: grant.matching_required ? 'true' : 'false',
      match_percentage: grant.match_percentage?.toString() ?? '',
      reporting_frequency: grant.reporting_frequency ?? '',
      status: grant.status,
      notes: grant.notes ?? '',
    });
    setEditOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('grants').update({
      name: editForm.name,
      grant_number: editForm.grant_number || null,
      grant_type: editForm.grant_type,
      awarding_agency: editForm.awarding_agency || null,
      cfda_number: editForm.cfda_number || null,
      funder_name: editForm.funder_name || null,
      award_amount: editForm.award_amount ? parseFloat(editForm.award_amount) : null,
      period_start: editForm.period_start || null,
      period_end: editForm.period_end || null,
      indirect_cost_rate: editForm.indirect_cost_rate ? parseFloat(editForm.indirect_cost_rate) : null,
      indirect_cost_type: editForm.indirect_cost_type || null,
      matching_required: editForm.matching_required === 'true',
      match_percentage: editForm.match_percentage ? parseFloat(editForm.match_percentage) : null,
      reporting_frequency: editForm.reporting_frequency || null,
      status: editForm.status,
      notes: editForm.notes || null,
    }).eq('id', id);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    toast.success('Grant updated');
    setEditOpen(false);
    loadGrant();
  }

  const f = (key: string) => ({
    value: editForm[key] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEditForm(p => ({ ...p, [key]: e.target.value })),
  });
  const sel = (key: string) => ({
    value: editForm[key] ?? '',
    onValueChange: (v: string) => setEditForm(p => ({ ...p, [key]: v })),
  });

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
            {grant.award_amount && <span className="font-semibold text-foreground">${Number(grant.award_amount).toLocaleString()}</span>}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={openEdit}>
          <Pencil className="h-4 w-4 mr-2" />Edit Grant
        </Button>
      </div>

      <Tabs defaultValue="requirements">
        <TabsList>
          <TabsTrigger value="requirements">
            Requirements{counts.requirements > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">{counts.requirements}</span>}
          </TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="transactions">
            Transactions{counts.transactions > 0 && <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">{counts.transactions}</span>}
          </TabsTrigger>
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
          <ComplianceTab grantId={id} grant={grant} />
        </TabsContent>
      </Tabs>

      {/* Edit Grant Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Grant</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <Label>Grant Name *</Label>
              <Input required {...f('name')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Grant Number</Label><Input {...f('grant_number')} /></div>
              <div className="space-y-1">
                <Label>Grant Type</Label>
                <Select {...sel('grant_type')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['federal','state','foundation','private'].map(v => <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Awarding Agency</Label><Input {...f('awarding_agency')} /></div>
              <div className="space-y-1"><Label>CFDA / ALN Number</Label><Input {...f('cfda_number')} /></div>
            </div>
            <div className="space-y-1"><Label>Funder Name</Label><Input {...f('funder_name')} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Award Amount</Label><Input type="number" {...f('award_amount')} /></div>
              <div className="space-y-1"><Label>Start Date</Label><Input type="date" {...f('period_start')} /></div>
              <div className="space-y-1"><Label>End Date</Label><Input type="date" {...f('period_end')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Indirect Cost Rate %</Label><Input type="number" step="0.01" {...f('indirect_cost_rate')} /></div>
              <div className="space-y-1">
                <Label>Rate Type</Label>
                <Select {...sel('indirect_cost_type')}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {[['de_minimis','De Minimis (10%)'],['predetermined','Predetermined'],['fixed','Fixed'],['provisional','Provisional'],['final','Final']].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <Select {...sel('status')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['active','pending','expired','closed'].map(v => <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Reporting Frequency</Label>
                <Select {...sel('reporting_frequency')}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {[['monthly','Monthly'],['quarterly','Quarterly'],['semi_annual','Semi-Annual'],['annual','Annual']].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
