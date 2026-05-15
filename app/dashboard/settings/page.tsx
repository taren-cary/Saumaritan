"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

type Settings = {
  firm_name: string;
  auditor_name: string;
  auditor_email: string;
};

const empty: Settings = { firm_name: '', auditor_name: '', auditor_email: '' };

export default function SettingsPage() {
  const [form, setForm] = useState<Settings>(empty);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('firm_name, auditor_name, auditor_email')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) setForm({
          firm_name: data.firm_name ?? '',
          auditor_name: data.auditor_name ?? '',
          auditor_email: data.auditor_email ?? '',
        });
        setIsLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', 1);
    setSaving(false);
    if (error) { toast.error('Failed to save settings'); return; }
    toast.success('Settings saved');
  }

  const f = (key: keyof Settings) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value })),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure your auditor profile.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auditor Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <Label>Firm / Practice Name</Label>
                <Input placeholder="Smith & Associates CPAs" {...f('firm_name')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Your Name</Label>
                  <Input placeholder="Jane Smith, CPA" {...f('auditor_name')} />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" placeholder="jane@firm.com" {...f('auditor_email')} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Settings'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Application</span>
            <span className="font-medium text-foreground">Saumaritan</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span>Compliance Framework</span>
            <span className="font-medium text-foreground">2 CFR Part 200 (Uniform Guidance)</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span>Audit Standard</span>
            <span className="font-medium text-foreground">GAGAS 2018 (Yellow Book)</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span>Single Audit Threshold</span>
            <span className="font-medium text-foreground">$750,000 federal expenditures</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
