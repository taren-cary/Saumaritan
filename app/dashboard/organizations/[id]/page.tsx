"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, Plus, ChevronRight, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type Org = { id: string; name: string; ein: string | null; contact_name: string | null; contact_email: string | null; address: string | null; notes: string | null };
type Grant = { id: string; name: string; grant_number: string | null; grant_type: string; awarding_agency: string | null; funder_name: string | null; award_amount: number | null; period_start: string | null; period_end: string | null; status: string };

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-gray-100 text-gray-700',
  closed: 'bg-red-100 text-red-700',
};

const emptyGrant = { name: '', grant_number: '', grant_type: 'federal', awarding_agency: '', cfda_number: '', funder_name: '', award_amount: '', period_start: '', period_end: '', indirect_cost_rate: '', indirect_cost_type: '', matching_required: 'false', match_percentage: '', reporting_frequency: '', status: 'active', notes: '' };

export default function OrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [org, setOrg] = useState<Org | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyGrant);

  async function fetchData() {
    const [orgRes, grantsRes] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', id).single(),
      supabase.from('grants').select('*').eq('organization_id', id).order('created_at', { ascending: false }),
    ]);
    if (orgRes.error) { toast.error('Organization not found'); return; }
    setOrg(orgRes.data);
    setGrants(grantsRes.data ?? []);
    setIsLoading(false);
  }

  useEffect(() => { fetchData(); }, [id]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('grants').insert([{
      organization_id: id,
      name: form.name.trim(),
      grant_number: form.grant_number || null,
      grant_type: form.grant_type,
      awarding_agency: form.awarding_agency || null,
      cfda_number: form.cfda_number || null,
      funder_name: form.funder_name || null,
      award_amount: form.award_amount ? parseFloat(form.award_amount) : null,
      period_start: form.period_start || null,
      period_end: form.period_end || null,
      indirect_cost_rate: form.indirect_cost_rate ? parseFloat(form.indirect_cost_rate) : null,
      indirect_cost_type: form.indirect_cost_type || null,
      matching_required: form.matching_required === 'true',
      match_percentage: form.match_percentage ? parseFloat(form.match_percentage) : null,
      reporting_frequency: form.reporting_frequency || null,
      status: form.status,
      notes: form.notes || null,
    }]);
    setSaving(false);
    if (error) { toast.error('Failed to create grant'); return; }
    toast.success('Grant created');
    setForm(emptyGrant);
    setOpen(false);
    fetchData();
  }

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value })),
  });

  const sel = (key: keyof typeof form) => ({
    value: form[key],
    onValueChange: (v: string) => setForm(p => ({ ...p, [key]: v })),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (!org) return <div className="text-sm text-destructive">Organization not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/organizations')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Organizations
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{org.name}</h2>
          <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
            {org.ein && <span>EIN: {org.ein}</span>}
            {org.contact_name && <span>{org.contact_name}</span>}
            {org.contact_email && <span>{org.contact_email}</span>}
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Grant</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Grant</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <Label>Grant Name *</Label>
                <Input placeholder="Community Development Block Grant" required {...f('name')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Grant Number</Label>
                  <Input placeholder="B-24-MC-00-0001" {...f('grant_number')} />
                </div>
                <div className="space-y-1">
                  <Label>Grant Type</Label>
                  <Select {...sel('grant_type')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="federal">Federal</SelectItem>
                      <SelectItem value="state">State</SelectItem>
                      <SelectItem value="foundation">Foundation</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Awarding Agency</Label>
                  <Input placeholder="HUD, HHS, NSF..." {...f('awarding_agency')} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label>CFDA / ALN Number</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild><HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">The Assistance Listing Number from your Notice of Award (e.g. 93.600 for HHS Head Start). Used in compliance reports.</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input placeholder="14.218" {...f('cfda_number')} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Funder Name</Label>
                <Input placeholder="U.S. Dept. of Housing and Urban Development" {...f('funder_name')} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Award Amount</Label>
                  <Input type="number" placeholder="500000" {...f('award_amount')} />
                </div>
                <div className="space-y-1">
                  <Label>Start Date</Label>
                  <Input type="date" {...f('period_start')} />
                </div>
                <div className="space-y-1">
                  <Label>End Date</Label>
                  <Input type="date" {...f('period_end')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Indirect Cost Rate %</Label>
                  <Input type="number" step="0.01" placeholder="10" {...f('indirect_cost_rate')} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label>Rate Type</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild><HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">De Minimis (10%) is available if you've never had a negotiated rate. Otherwise use the type from your NICRA agreement with your cognizant federal agency.</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select {...sel('indirect_cost_type')}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="de_minimis">De Minimis (10%)</SelectItem>
                      <SelectItem value="predetermined">Predetermined</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                      <SelectItem value="provisional">Provisional</SelectItem>
                      <SelectItem value="final">Final</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Matching Required</Label>
                  <Select {...sel('matching_required')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">No</SelectItem>
                      <SelectItem value="true">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.matching_required === 'true' && (
                  <div className="space-y-1">
                    <Label>Match %</Label>
                    <Input type="number" step="0.01" placeholder="25" {...f('match_percentage')} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Reporting Frequency</Label>
                  <Select {...sel('reporting_frequency')}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select {...sel('status')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea rows={2} {...f('notes')} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create Grant'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {grants.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-sm text-muted-foreground">No grants yet. Add the first grant for this organization.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {grants.map(g => (
            <Card
              key={g.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/dashboard/grants/${g.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{g.name}</CardTitle>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge className={`text-xs ${statusColors[g.status] ?? ''}`}>{g.status}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{g.awarding_agency || g.funder_name || g.grant_type}</p>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {g.period_start && g.period_end ? `${g.period_start} → ${g.period_end}` : 'No dates set'}
                  </span>
                  <span className="font-semibold">
                    {g.award_amount ? `$${Number(g.award_amount).toLocaleString()}` : 'Amount TBD'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
