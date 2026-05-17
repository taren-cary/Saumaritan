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
  source_file: string | null;
};

const BUDGET_CATEGORIES = ['personnel','fringe','travel','equipment','supplies','contractual','other_direct','indirect'];

const riskStyles: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

const statusStyles: Record<string, string> = {
  pending_review: 'bg-gray-100 text-gray-600',
  allowable: 'bg-green-100 text-green-700',
  questioned: 'bg-yellow-100 text-yellow-700',
  unallowable: 'bg-red-100 text-red-700',
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

  const loadTransactions = useCallback(async () => {
    const { data } = await supabase
      .from('transactions')
      .select('id,date,description,amount,vendor,budget_category,allowability_status,source_file')
      .eq('grant_id', grantId)
      .order('date', { ascending: false, nullsFirst: false });
    setTransactions(data ?? []);
    setIsLoading(false);
  }, [grantId]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  async function sendImageToAPI(imageFile: File | Blob, filename: string): Promise<number> {
    const formData = new FormData();
    formData.append('file', imageFile, filename);
    formData.append('grant_id', grantId);
    const res = await globalThis.fetch('/api/upload', { method: 'POST', body: formData });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Extraction failed');
    return json.count ?? 0;
  }

  async function convertPDFToImages(file: File): Promise<{ blob: Blob; page: number }[]> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const pages = Math.min(pdf.numPages, 10);
    const images: { blob: Blob; page: number }[] = [];

    for (let i = 1; i <= pages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
      images.push({ blob, page: i });
    }
    return images;
  }

  async function processFile(file: File) {
    setIsUploading(true);
    try {
      const name = file.name.toLowerCase();
      const isCSV = name.endsWith('.csv');
      const isXLSX = name.endsWith('.xlsx');
      const isPDF = name.endsWith('.pdf');

      if (isCSV || isXLSX) {
        let rows: Record<string, unknown>[] = [];
        if (isCSV) {
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
      } else if (isPDF) {
        // Convert PDF pages to images client-side, then send each to vision API
        toast.info('Converting PDF pages...');
        const images = await convertPDFToImages(file);
        let total = 0;
        for (const { blob, page } of images) {
          const count = await sendImageToAPI(blob, `${file.name}-page${page}.png`);
          total += count;
        }
        toast.success(`Extracted ${total} transaction${total !== 1 ? 's' : ''} from ${file.name} (${images.length} page${images.length !== 1 ? 's' : ''})`);
        loadTransactions();
      } else {
        // Image — send directly to vision API
        const count = await sendImageToAPI(file, file.name);
        toast.success(`Extracted ${count} transaction${count !== 1 ? 's' : ''} from ${file.name}`);
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
            <p className="text-xs text-muted-foreground">CSV, XLSX — or PDF / JPG / PNG for AI extraction</p>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
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
                    <Badge className={`text-xs ${statusStyles[t.allowability_status] ?? ''}`}>
                      {t.allowability_status?.replace('_', ' ')}
                    </Badge>
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
    </div>
  );
}
