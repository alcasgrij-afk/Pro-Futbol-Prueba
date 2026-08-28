import type { Metadata } from 'next';
import './globals.css';
import ChatWidget from '../components/ChatWidget';

export const metadata: Metadata = {
  title: 'Pro Futbol Antigua - Panel Admin',
  description: 'Panel administrativo de reservas, pagos y gestion deportiva',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
