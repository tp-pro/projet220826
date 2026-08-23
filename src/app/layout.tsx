import type { Metadata } from 'next';
import { Jost, Public_Sans } from 'next/font/google';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { siteConfig } from '@/config/site';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { env } from '@/config/env';
import './globals.css';

// Titrage géométrique (direction "Balise", cf. listings-setup.md) — variable pour
// piloter le poids selon le contexte (eyebrows en 500, titres en 600/700).
const jost = Jost({
  variable: '--font-jost',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,

  robots:
  process.env.NEXT_PUBLIC_NOINDEX === 'true'
    ? {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
        },
      }
    : {
        index: true,
        follow: true,
      },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${jost.variable} ${publicSans.variable} flex min-h-screen flex-col antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-surface"
        >
          Aller au contenu principal
        </a>
        <Header />
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
