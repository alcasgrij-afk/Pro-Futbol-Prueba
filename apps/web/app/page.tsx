import { redirect } from 'next/navigation';

// Toda peticion publica al root aterriza en la landing de /home.
export default function HomePage() {
  redirect('/home');
}