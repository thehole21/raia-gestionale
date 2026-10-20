import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'RAIA Workspace · Gestionale',
  description: 'Gestione lavori, clienti, ordini e bozze di fatturazione',
  icons: { icon: '/images/raia-monogram-transparent.png', apple: '/images/raia-monogram-transparent.png' },
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="it"><body>{children}</body></html>;
}
