"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Space_Grotesk } from 'next/font/google';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, LayoutDashboard, Loader2, LogOut, Settings, Users } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['700'] });

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push('/login');
      } else {
        setIsAuthed(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) router.push('/login');
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const nav = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Organizations', icon: Users, href: '/dashboard/organizations' },
    { label: 'Transactions', icon: FileSpreadsheet, href: '/dashboard/transactions' },
    { label: 'Settings', icon: Settings, href: '/dashboard/settings' },
  ];

  if (isAuthed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="flex h-16 items-center px-4 gap-3">
          <Image src="/saumaritanlogo.svg" alt="Saumaritan" width={44} height={44} className="dark:brightness-150" />
          <h1 className={`text-xl font-bold tracking-wide ${spaceGrotesk.className}`} style={{ color: '#1d4e89' }}>Saumaritan</h1>
          <div className="ml-auto flex items-center gap-2">
            <ModeToggle />
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4 mr-2" />Sign out
            </Button>
          </div>
        </div>
      </nav>

      <div className="flex">
        <aside className="w-56 border-r h-[calc(100vh-4rem)] shrink-0">
          <nav className="p-3 space-y-1">
            {nav.map(({ label, icon: Icon, href }) => (
              <Button
                key={href}
                variant={pathname === href || (href !== '/dashboard' && pathname.startsWith(href)) ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => router.push(href)}
              >
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </Button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
