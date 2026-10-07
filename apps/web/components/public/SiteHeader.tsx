'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const ANCHOR_ITEMS = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'reservar', label: 'Reservar' },
  { id: 'canchas', label: 'Canchas' },
];

const ACADEMIA_ITEM = { href: '/academia', label: 'Academia' };

const ANCHOR_ITEMS_REST = [
  { id: 'precios', label: 'Precios' },
  { id: 'informacion', label: 'Información' },
  { id: 'contacto', label: 'Contacto' },
];

export default function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  // Los anchors (#inicio, etc.) solo existen en /home: si estamos en otra
  // pagina publica (p.ej. /academia) hay que anteponer /home para que
  // Next navegue de vuelta y haga scroll nativo al id.
  const anchorHref = (id: string) => (pathname === '/home' ? `#${id}` : `/home#${id}`);

  useEffect(() => {
    // Smooth scroll for anchor links (solo aplica a hrefs "#id", es decir
    // cuando ya estamos en /home; los "/home#id" los maneja Next.js).
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const href = (e.currentTarget as HTMLAnchorElement).getAttribute('href');
        if (!href || href === '#') { setMobileMenuOpen(false); return; }
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setMobileMenuOpen(false);
        }
      });
    });
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <nav className="max-w-[1180px] mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/home" className="flex items-center">
          <Image src="/profutbollogo.png" alt="Pro Futbol Antigua" width={453} height={162} className="h-9 w-auto" priority />
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-8 text-[15px] font-medium">
          {ANCHOR_ITEMS.map((item) => (
            <li key={item.id}><a href={anchorHref(item.id)} className="text-[#0a3d7d] hover:text-[#8f6c1c] transition-colors border-b-2 border-transparent hover:border-[#bf9b1f] pb-1">{item.label}</a></li>
          ))}
          <li><Link href={ACADEMIA_ITEM.href} className="text-[#0a3d7d] hover:text-[#8f6c1c] transition-colors border-b-2 border-transparent hover:border-[#bf9b1f] pb-1">{ACADEMIA_ITEM.label}</Link></li>
          {ANCHOR_ITEMS_REST.map((item) => (
            <li key={item.id}><a href={anchorHref(item.id)} className="text-[#0a3d7d] hover:text-[#8f6c1c] transition-colors border-b-2 border-transparent hover:border-[#bf9b1f] pb-1">{item.label}</a></li>
          ))}
        </ul>

        <div className="flex items-center gap-4">
          <Link
            href="/reservar"
            className="hidden md:inline-flex items-center gap-2 bg-[#d8b32d] text-[#0a3d7d] px-6 py-3 rounded-full font-semibold hover:bg-[#d0a92a] transition-all hover:-translate-y-0.5 shadow-lg"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="5" width="18" height="16" rx="2"/>
              <path d="M16 3v4M8 3v4M3 10h18"/>
            </svg>
            Reservar Ahora
          </Link>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex flex-col gap-1.5 p-2"
            aria-label="Abrir menú"
          >
            <span className="w-6 h-0.5 bg-[#0a3d7d] rounded"></span>
            <span className="w-6 h-0.5 bg-[#0a3d7d] rounded"></span>
            <span className="w-6 h-0.5 bg-[#0a3d7d] rounded"></span>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 py-4 px-6">
          {ANCHOR_ITEMS.map((item) => (
            <a key={item.id} href={anchorHref(item.id)} onClick={() => setMobileMenuOpen(false)} className="block py-3 text-[#0a3d7d] font-medium border-b border-gray-50">{item.label}</a>
          ))}
          <Link href={ACADEMIA_ITEM.href} onClick={() => setMobileMenuOpen(false)} className="block py-3 text-[#0a3d7d] font-medium border-b border-gray-50">{ACADEMIA_ITEM.label}</Link>
          {ANCHOR_ITEMS_REST.map((item, i) => (
            <a
              key={item.id}
              href={anchorHref(item.id)}
              onClick={() => setMobileMenuOpen(false)}
              className={`block py-3 text-[#0a3d7d] font-medium ${i < ANCHOR_ITEMS_REST.length - 1 ? 'border-b border-gray-50' : ''}`}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
