import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { AuthHydrator } from '@/components/providers/AuthHydrator';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'AI Log Analyzer | Security SaaS',
  description: 'Enterprise-grade AI-powered log analysis for security analysts. Detect threats in real-time.',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'AI Log Analyzer - Security Intelligence Platform',
    description: 'Advanced AI log analysis for security teams. Powered by Claude.',
    images: [{ url: '/og-image.png' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} dark`}>
      <body className="min-h-screen bg-zinc-950 text-zinc-50 font-sans antialiased">
        <QueryProvider>
          <AuthProvider>
            <AuthHydrator />
            {children}
          </AuthProvider>
        </QueryProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
