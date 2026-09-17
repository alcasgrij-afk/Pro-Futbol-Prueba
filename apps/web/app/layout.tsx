import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import ChatWidget from '../components/ChatWidget';

export const metadata: Metadata = {
  // Titulo por defecto: el publico (landing, torneos, reservar, login, pago)
  // no debe heredar el titulo del panel admin. Las rutas de admin lo
  // sobreescriben desde sus layout.tsx.
  title: 'Pro Futbol Antigua',
  description: 'Canchas, torneos y academia deportiva en Antigua Guatemala',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
