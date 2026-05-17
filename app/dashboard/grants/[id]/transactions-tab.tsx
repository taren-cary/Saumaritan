"use client";

import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { FileUp, Loader2, Search, Trash2 } from 'lucide-react';

type Transaction = {
  id: string;
  date: string | null;
  description: string | null;
  amount: number | null;
  vendor: string | null;
  budget_category: string | null;
  allowability_status: string;
  auditor_note: string | null;
  source_file: string | null;
};

const BUDGET_CATEGORIES = ['personnel','fringe','travel','equipment','supplies','contractual','other_direct','indirect'];

const statusStyles: Record<string, string> = {
  pending_review: 'bg-gray-100 text-gray-600',
  questioned: 'bg-yellow-100 text-yellow-700',
  cleared: 'bg-green-100 text-green-700',
  disallowed: 'bg-red-100 text-red-700',
};

const riskStyles: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};


function getRiskLevel(amount: number | null): 'low' | 'medium' | 'high' {
  if (!amount || amount < 500) return 'low';
  if (amount < 5000) return 'medium';
  return 'high';
}

function normalizeRow(row: Record<string, unknown>, filename: string, grantId: string) {
  const get = (...keys: string[]): string | null => {
    for (const k of keys) {
      for (const c of [k, k.toLowerCase(), k.toUpperCase()]) {
        const v = row[c];
        if (v !== undefined && v !== '') return String(v);
      }
    }
    return null;
  };
  const rawAmt = get('amount','Amount','debit','Debit','credit','Credit','total','Total');
  const amount = rawAmt ? parseFloat(rawAmt.replace(/[^0-9.-]/g, '')) : null;
  const budgetCat = get('budget_category','object_class','ObjectClass') || null;

  return {
    grant_id: grantId,
    date: get('date','Date','transaction_date','Transaction Date'),
    description: get('description','Description','memo','Memo','note','Note'),
    amount: isNaN(amount as number) ? null : amount,
    vendor: get('vendor','Vendor','payee','Payee','merchant','Merchant'),
    category: get('category','Category','type','Type'),
    budget_category: BUDGET_CATEGORIES.includes(budgetCat ?? '') ? budgetCat : null,
    risk_level: getRiskLevel(amount),
    status: 'pending',
    allowability_status: 'pending_review',
    source_file: filename,
    raw_data: row,
  };
}

export default function TransactionsTab({ grantId }: { grantId: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [noteDialogTxId, setNoteDialogTxId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const loadTransactions = useCallback(async () => {
    const { data } = await supabase
      .from('transactions')
      .select('id,date,description,amount,vendor,budget_category,allowability_status,auditor_note,source_file')
      .eq('grant_id', grantId)
      .order('date', { ascending: false, nullsFirst: false });
    setTransactions(data ?? []);
    setIsLoading(false);
  }, [grantId]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  async function processFile(file: File) {
    setIsUploading(true);
    try {
      const name = file.name.toLowerCase();

      if (name.endsWith('.csv') || name.endsWith('.xlsx')) {
        let rows: Record<string, unknown>[] = [];
        if (name.endsWith('.csv')) {
          const text = await file.text();
          const result = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
          rows = result.data;
        } else {
          const buffer = await file.arrayBuffer();
          const wb = XLSX.read(buffer);
          rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
        }
        if (rows.length === 0) { toast.error('No data found in file.'); return; }
        const records = rows.map(r => normalizeRow(r, file.name, grantId));
        const { error } = await supabase.from('transactions').insert(records);
        if (error) throw error;
        toast.success(`Imported ${records.length} transactions from ${file.name}`);
        loadTransactions();
      } else {
        // PDF or image — send to server for AI extraction
        const formData = new FormData();
        formData.append('file', file);
        formData.append('grant_id', grantId);
        const res = await globalThis.fetch('/api/upload', { method: 'POST', body: formData });
        const json = await res.json();
        if (!res.ok) { toast.error(json.error || 'Extraction failed'); return; }
        toast.success(`Extracted ${json.count} transaction${json.count !== 1 ? 's' : ''} from ${file.name}`);
        loadTransactions();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Import failed. Check file format and try again.');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(id: string) {
    await supabase.from('transactions').delete().eq('id', id);
    setTransactions(t => t.filter(x => x.id !== id));
  }

  async function updateCategory(id: string, category: string) {
    await supabase.from('transactions').update({ budget_category: category || null }).eq('id', id);
    setTransactions(ts => ts.map(t => t.id === id ? { ...t, budget_category: category || null } : t));
  }

  async function updateAllowability(id: string, status: string) {
    if (status === 'disallowed') {
      setNoteDialogTxId(id);
      setNoteText('');
      // Optimistically update status, note saved when dialog is confirmed
      await supabase.from('transactions').update({ allowability_status: status }).eq('id', id);
      setTransactions(ts => ts.map(t => t.id === id ? { ...t, allowability_status: status } : t));
      return;
    }
    await supabase.from('transactions').update({ allowability_status: status }).eq('id', id);
    setTransactions(ts => ts.map(t => t.id === id ? { ...t, allowability_status: status } : t));
  }

  async function saveNote() {
    if (!noteDialogTxId) return;
    await supabase.from('transactions').update({ auditor_note: noteText || null }).eq('id', noteDialogTxId);
    setTransactions(ts => ts.map(t => t.id === noteDialogTxId ? { ...t, auditor_note: noteText || null } : t));
    setNoteDialogTxId(null);
    setNoteText('');
  }

  async function markAllReviewed() {
    const pending = transactions.filter(t => t.allowability_status === 'pending_review').map(t => t.id);
    if (pending.length === 0) { toast.info('No pending transactions to mark.'); return; }
    await supabase.from('transactions').update({ allowability_status: 'cleared' }).in('id', pending);
    setTransactions(ts => ts.map(t => t.allowability_status === 'pending_review' ? { ...t, allowability_status: 'cleared' } : t));
    toast.success(`Marked ${pending.length} transaction${pending.length !== 1 ? 's' : ''} as Cleared`);
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/heic': ['.heic'],
    },
    multiple: false,
    disabled: isUploading,
    onDrop: ([f]) => f && processFile(f),
  });

  const filtered = transactions.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.description?.toLowerCase().includes(q) || t.vendor?.toLowerCase().includes(q) || t.source_file?.toLowerCase().includes(q);
  });

  const total = filtered.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  return (
    <div className="space-y-4">
      <Card
        {...getRootProps()}
        className={`p-6 border-2 border-dashed cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'} ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="flex items-center gap-3">
          {isUploading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <FileUp className="h-6 w-6 text-muted-foreground" />}
          <div>
            <p className="text-sm font-medium">{isUploading ? 'Importing...' : isDragActive ? 'Drop here' : 'Upload CSV or XLSX'}</p>
            <p className="text-xs text-muted-foreground">CSV, XLSX — or PDF, JPG, PNG for AI extraction</p>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {transactions.some(t => t.allowability_status === 'pending_review') && (
          <Button variant="outline" size="sm" onClick={markAllReviewed}>
            Mark All Reviewed
          </Button>
        )}
        {filtered.length > 0 && (
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            {filtered.length} rows · ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {search ? 'No transactions match.' : 'No transactions yet. Upload a file above.'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Budget Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
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
                    <Select value={t.budget_category ?? 'none'} onValueChange={v => updateCategory(t.id, v === 'none' ? '' : v)}>
                      <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Uncategorized" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Uncategorized</SelectItem>
                        {BUDGET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Select value={t.allowability_status ?? 'pending_review'} onValueChange={v => updateAllowability(t.id, v)}>
                        <SelectTrigger className={`h-7 text-xs w-36 ${statusStyles[t.allowability_status ?? ''] ?? ''}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending_review">Pending Review</SelectItem>
                          <SelectItem value="questioned">Questioned</SelectItem>
                          <SelectItem value="cleared">Cleared</SelectItem>
                          <SelectItem value="disallowed">Disallowed</SelectItem>
                        </SelectContent>
                      </Select>
                      {t.allowability_status === 'disallowed' && t.auditor_note && (
                        <p className="text-xs text-red-600 italic max-w-[140px] truncate" title={t.auditor_note}>
                          {t.auditor_note}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Auditor note dialog — appears when marking a transaction as Disallowed */}
      <Dialog open={!!noteDialogTxId} onOpenChange={open => { if (!open) { saveNote(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Auditor Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Transaction marked as <strong className="text-red-600">Disallowed</strong>. Add a note explaining why this cost is being disallowed — this will appear in the final compliance report alongside the AI finding.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Auditor's Reasoning</Label>
              <Textarea
                placeholder="e.g. Nonprofit confirmed this was an error. Entertainment costs are unallowable per 2 CFR §200.438. Funds to be returned."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={3}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNoteDialogTxId(null); setNoteText(''); }}>
              Skip
            </Button>
            <Button onClick={saveNote}>
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
