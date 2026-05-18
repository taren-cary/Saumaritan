"use client";

import Image from 'next/image';
import { Space_Grotesk } from 'next/font/google';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, LayoutDashboard, Settings, Users } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['700'] });

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const nav = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Organizations', icon: Users, href: '/dashboard/organizations' },
    { label: 'Transactions', icon: FileSpreadsheet, href: '/dashboard/transactions' },
    { label: 'Settings', icon: Settings, href: '/dashboard/settings' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="flex h-16 items-center px-4 gap-4">
          <Image src="/saumaritanlogo.svg" alt="Saumaritan" width={44} height={44} className="dark:brightness-150" />
          <h1 className={`text-xl font-bold tracking-wide ${spaceGrotesk.className}`} style={{ color: '#1d4e89' }}>Saumaritan</h1>
          <div className="ml-auto flex items-center space-x-4">
            <ModeToggle />
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
