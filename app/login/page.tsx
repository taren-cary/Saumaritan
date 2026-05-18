"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Space_Grotesk } from 'next/font/google';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck } from 'lucide-react';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['600', '700'] });

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('Invalid email or password. Please check your credentials and try again.');
      setIsLoading(false);
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Brand header */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/saumaritanlogo.svg"
            alt="Saumaritan"
            width={88}
            height={88}
            className="mb-5 drop-shadow-sm"
          />
          <h1
            className={`text-4xl font-bold tracking-wide ${spaceGrotesk.className}`}
            style={{ color: '#1d4e89' }}
          >
            Saumaritan
          </h1>
          <p className="text-sm text-muted-foreground mt-2 tracking-wide uppercase font-medium">
            Grant Compliance Auditing Platform
          </p>
        </div>

        {/* Sign in card */}
        <div className="bg-background border rounded-2xl shadow-lg p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Sign in to your account</h2>
            <p className="text-sm text-muted-foreground">
              Access is restricted to authorized auditors.
            </p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="auditor@firm.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                disabled={isLoading}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-10"
              />
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-10 text-white font-medium"
              style={{ backgroundColor: '#1d4e89' }}
              disabled={isLoading}
            >
              {isLoading
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing in...</>
                : 'Sign In'
              }
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-6 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Secure · Authorized access only · © {new Date().getFullYear()} Saumaritan</span>
        </div>
      </div>
    </div>
  );
}
