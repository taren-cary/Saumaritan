"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2, BookOpen } from 'lucide-react';

type Req = {
  id: string;
  category: string;
  title: string;
  description: string;
  regulatory_citation: string | null;
  requirement_type: string | null;
  max_amount: number | null;
  documentation_required: string | null;
};

const CATEGORIES = [
  'Activities Allowed or Unallowed',
  'Allowable Costs / Cost Principles',
  'Cash Management',
  'Eligibility',
  'Equipment & Real Property',
  'Matching / Level of Effort / Earmarking',
  'Period of Performance',
  'Personnel & Compensation',
  'Procurement / Suspension / Debarment',
  'Program Income',
  'Reporting',
  'Subrecipient Monitoring',
  'Special Tests & Provisions',
  'Travel',
  'Budget Limit',
  'Indirect Cost Rate',
  'Other',
];

const REQ_TYPES = [
  { value: 'allowable_costs', label: 'Allowable Costs' },
  { value: 'activities_allowed', label: 'Activities Allowed' },
  { value: 'budget_limit', label: 'Budget Limit' },
  { value: 'period_of_performance', label: 'Period of Performance' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'matching', label: 'Matching / Cost Share' },
  { value: 'indirect_cost', label: 'Indirect Cost' },
  { value: 'reporting', label: 'Reporting' },
  { value: 'eligibility', label: 'Eligibility' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'subrecipient', label: 'Subrecipient Monitoring' },
  { value: 'cash_management', label: 'Cash Management' },
  { value: 'program_income', label: 'Program Income' },
  { value: 'special_provision', label: 'Special Provision' },
  { value: 'travel', label: 'Travel' },
];

const empty = { category: '', title: '', description: '', regulatory_citation: '', requirement_type: '', max_amount: '', documentation_required: '' };

export default function RequirementsTab({ grantId }: { grantId: string }) {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);

  async function fetchReqs() {
    const { data } = await supabase
      .from('grant_requirements')
      .select('*')
      .eq('grant_id', grantId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    setReqs(data ?? []);
    setIsLoading(false);
  }

  useEffect(() => { fetchReqs(); }, [grantId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.category) return;
    setSaving(true);
    const { error } = await supabase.from('grant_requirements').insert([{
      grant_id: grantId,
      category: form.category,
      title: form.title.trim(),
      description: form.description.trim(),
      regulatory_citation: form.regulatory_citation || null,
      requirement_type: form.requirement_type || null,
      max_amount: form.max_amount ? parseFloat(form.max_amount) : null,
      documentation_required: form.documentation_required || null,
    }]);
    setSaving(false);
    if (error) { toast.error('Failed to add requirement'); return; }
    toast.success('Requirement added');
    setForm(empty);
    setOpen(false);
    fetchReqs();
  }

  async function handleDelete(reqId: string) {
    await supabase.from('grant_requirements').update({ is_active: false }).eq('id', reqId);
    setReqs(r => r.filter(x => x.id !== reqId));
    toast.success('Requirement removed');
  }

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value })),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define the compliance requirements the AI will check each transaction against.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Requirement</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Compliance Requirement</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Requirement Type</Label>
                <Select value={form.requirement_type} onValueChange={v => setForm(p => ({ ...p, requirement_type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                  <SelectContent>
                    {REQ_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Title *</Label>
                <Input placeholder="No Entertainment Expenses" required {...f('title')} />
              </div>
              <div className="space-y-1">
                <Label>Description *</Label>
                <Textarea
                  placeholder="Entertainment costs are unallowable per 2 CFR §200.438. This includes costs of amusement, diversion, and social activities."
                  required rows={3}
                  {...f('description')}
                />
              </div>
              <div className="space-y-1">
                <Label>Regulatory Citation</Label>
                <Input placeholder="2 CFR §200.438" {...f('regulatory_citation')} />
              </div>
              <div className="space-y-1">
                <Label>Maximum Allowable Amount (optional)</Label>
                <Input type="number" placeholder="Leave blank if no cap" {...f('max_amount')} />
              </div>
              <div className="space-y-1">
                <Label>Documentation Required</Label>
                <Textarea placeholder="Invoices, receipts, purchase orders..." rows={2} {...f('documentation_required')} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add Requirement'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : reqs.length === 0 ? (
        <Card className="p-10 text-center">
          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No requirements yet. Add requirements to enable AI compliance checking.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reqs.map(r => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="outline" className="text-xs">{r.category}</Badge>
                    {r.regulatory_citation && (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{r.regulatory_citation}</code>
                    )}
                    {r.max_amount && (
                      <span className="text-xs text-muted-foreground">Max: ${Number(r.max_amount).toLocaleString()}</span>
                    )}
                  </div>
                  <p className="font-medium text-sm">{r.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
                  {r.documentation_required && (
                    <p className="text-xs text-muted-foreground mt-1">📎 {r.documentation_required}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleDelete(r.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
