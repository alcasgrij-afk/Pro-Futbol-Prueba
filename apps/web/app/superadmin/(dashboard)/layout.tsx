import type { Metadata } from 'next';
import SuperadminLayout from '../../../components/SuperadminLayout';

export const metadata: Metadata = {
  title: 'Superadmin - Pro Futbol Antigua',
  robots: { index: false, follow: false },
};

// Route group (no agrega segmento a la URL): separa el guard de sesion de
// /superadmin/login, que debe quedar fuera de el para no generar un loop
// de redirecciones (mismo patron que app/(dashboard)/layout.tsx).
export default function SuperadminDashboardLayout({ children }: { children: React.ReactNode }) {
  return <SuperadminLayout>{children}</SuperadminLayout>;
}
