'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export default function SiteFooter() {
  const pathname = usePathname();
  const anchorHref = (id: string) => (pathname === '/home' ? `#${id}` : `/home#${id}`);

  return (
    <footer className="bg-[#0a3d7d] text-[#cfe0fb] py-16 px-6">
      <div className="max-w-[1180px] mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-9 mb-12">
          <div>
            <Image src="/profutbollogo.png" alt="Pro Futbol Antigua" width={453} height={162} className="h-9 w-auto mb-3.5" />
            <p className="text-sm text-[#9fb6de] leading-relaxed max-w-[260px]">
              Canchas de fútbol sintéticas en Antigua Guatemala. Reserva fácil, rápido y seguro.
            </p>
            <div className="flex gap-3 mt-4">
              {[
                { label: 'Instagram', href: 'https://www.instagram.com/profutbol_gt/?hl=en' },
                { label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=100063443599213' },
                { label: 'WhatsApp', href: 'https://wa.me/50237063030' },
                { label: 'TikTok', href: 'https://www.tiktok.com/@profutbol_gt' },
                { label: 'Waze', href: 'https://www.waze.com/es-419/live-map/directions/profutbol-antigua-calle-del-chajon-25-la-antigua-guatemala?to=place.w.176488594.1764623792.17900633' },
              ].map(({ label, href }, i) => (
                <a key={i} href={href} aria-label={label} target={href === '#' ? undefined : '_blank'} rel={href === '#' ? undefined : 'noopener noreferrer'} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                  <svg className="w-4 h-4 stroke-[#cfe0fb]" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                    {i === 0 && <><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></>}
                    {i === 1 && <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>}
                    {i === 2 && <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>}
                    {i === 3 && <><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></>}
                    {i === 4 && <><path d="M12 21s-7-7.58-7-12a7 7 0 0 1 14 0c0 4.42-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></>}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div>
            <h5 className="text-white text-sm font-semibold mb-4 tracking-wide">Navegación</h5>
            <ul className="space-y-2.5 text-sm">
              <li><a href={anchorHref('inicio')} className="text-[#9fb6de] hover:text-[#d8b32d] transition-colors">Inicio</a></li>
              <li><a href={anchorHref('reservar')} className="text-[#9fb6de] hover:text-[#d8b32d] transition-colors">Reservar</a></li>
              <li><a href={anchorHref('canchas')} className="text-[#9fb6de] hover:text-[#d8b32d] transition-colors">Canchas</a></li>
              <li><Link href="/academia" className="text-[#9fb6de] hover:text-[#d8b32d] transition-colors">Academia</Link></li>
              <li><a href={anchorHref('precios')} className="text-[#9fb6de] hover:text-[#d8b32d] transition-colors">Precios</a></li>
            </ul>
          </div>

          <div>
            <h5 className="text-white text-sm font-semibold mb-4 tracking-wide">Empresa</h5>
            <ul className="space-y-2.5 text-sm">
              <li><a href={anchorHref('informacion')} className="text-[#9fb6de] hover:text-[#d8b32d] transition-colors">Información</a></li>
              <li><a href="#" className="text-[#9fb6de] hover:text-[#d8b32d] transition-colors">Nosotros</a></li>
              <li><a href="#" className="text-[#9fb6de] hover:text-[#d8b32d] transition-colors">Preguntas frecuentes</a></li>
              <li><a href={anchorHref('contacto')} className="text-[#9fb6de] hover:text-[#d8b32d] transition-colors">Contacto</a></li>
            </ul>
          </div>

          <div>
            <h5 className="text-white text-sm font-semibold mb-4 tracking-wide">Legal</h5>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#" className="text-[#9fb6de] hover:text-[#d8b32d] transition-colors">Términos y condiciones</a></li>
              <li><a href="#" className="text-[#9fb6de] hover:text-[#d8b32d] transition-colors">Política de privacidad</a></li>
              <li><a href="#" className="text-[#9fb6de] hover:text-[#d8b32d] transition-colors">Política de cancelación</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-[#7f99c7]">
          <span>© 2026 Pro Futbol Antigua. Todos los derechos reservados.</span>
          <span>Hecho con ⚽ en Antigua Guatemala</span>
        </div>
      </div>
    </footer>
  );
}
