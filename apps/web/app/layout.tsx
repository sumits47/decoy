import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Decoy',
  description: 'A web-first social bluffing party game.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
