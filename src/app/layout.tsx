import type { Metadata } from 'next';
import './globals.css';
import { LemmaProvider } from '@/components/LemmaProvider';
import { ReactQueryProvider } from '@/components/ReactQueryProvider';

export const metadata: Metadata = {
  title: 'Docta — AI Contract Intelligence',
  description: 'Upload any contract and get instant AI-powered risk analysis, clause breakdown, and negotiation advice.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <LemmaProvider>
            {children}
          </LemmaProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
