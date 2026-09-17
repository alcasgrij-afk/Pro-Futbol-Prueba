import type { Metadata } from 'next';
import LandingPage from '../landing-page';

export const metadata: Metadata = {
  title: 'Pro Futbol Antigua - Canchas, torneos y academia',
  description:
    'Reservá canchas de futbol 5 y 7 en Antigua Guatemala. Reservas en línea por chat, torneos y academia.',
};

export default function HomePage() {
  return <LandingPage />;
}