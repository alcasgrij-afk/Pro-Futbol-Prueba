import type { Metadata } from 'next';
import AdminLayout from '../../components/AdminLayout';

export const metadata: Metadata = {
  title: 'Panel Admin - Pro Futbol Antigua',
};

export default function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
