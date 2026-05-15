"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Building2, Plus, ChevronRight } from 'lucide-react';

type Org = {
  id: string;
  name: string;
  ein: string | null;
  contact_name: string | null;
  contact_email: string | null;
  created_at: string;
  grant_count?: number;
};

const empty = { name: '', ein: '', contact_name: '', contact_email: '', address: '', notes: '' };

export default function OrganizationsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);

  async function fetchOrgs() {
    const { data, error } = await supabase
      .from('organizations')
      .select('*, grants(count)')
      .order('created_at', { ascending: false });
    if (error) { toast.error('Failed to load organizations'); return; }
    setOrgs((data ?? []).map((o: any) => ({ ...o, grant_count: o.grants?.[0]?.count ?? 0 })));
    setIsLoading(false);
  }

  useEffect(() => { fetchOrgs(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('organizations').insert([{
      name: form.name.trim(),
      ein: form.ein || null,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      address: form.address || null,
      notes: form.notes || null,
    }]);
    setSaving(false);
    if (error) { toast.error('Failed to create organization'); return; }
    toast.success('Organization created');
    setForm(empty);
    setOpen(false);
    fetchOrgs();
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Organizations</h2>
          <p className="text-sm text-muted-foreground mt-1">Nonprofits you are auditing</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Organization</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Organization</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <Label>Organization Name *</Label>
                <Input placeholder="Helping Hands Nonprofit Inc." required {...field('name')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>EIN</Label>
                  <Input placeholder="12-3456789" {...field('ein')} />
                </div>
                <div className="space-y-1">
                  <Label>Contact Name</Label>
                  <Input placeholder="Jane Smith" {...field('contact_name')} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Contact Email</Label>
                <Input type="email" placeholder="jane@nonprofit.org" {...field('contact_email')} />
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input placeholder="123 Main St, City, ST 12345" {...field('address')} />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea placeholder="Any additional notes..." {...field('notes')} rows={2} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : orgs.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No organizations yet. Add your first nonprofit client.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orgs.map(org => (
            <Card
              key={org.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/dashboard/organizations/${org.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base leading-tight">{org.name}</CardTitle>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                </div>
                {org.ein && <p className="text-xs text-muted-foreground">EIN: {org.ein}</p>}
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{org.contact_name || 'No contact'}</span>
                  <span className="font-medium">{org.grant_count} grant{org.grant_count !== 1 ? 's' : ''}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
