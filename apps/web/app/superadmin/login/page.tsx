'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldWarning } from '@phosphor-icons/react';
import { loginSuperadmin } from '../../../lib/superadmin-client';

// Tema slate/zinc deliberadamente distinto del navy/amarillo de /admin: es
// una señal visual inmediata de que esto no es el panel de negocio.
export default function SuperadminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await loginSuperadmin(password);
      router.push('/superadmin');
    } catch {
      setError('Contraseña incorrecta.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl shadow-xl p-8">
        <div className="text-center mb-6">
          <ShieldWarning size={32} weight="bold" className="mx-auto text-amber-400 mb-2" aria-hidden="true" />
          <h1 className="text-xl font-bold text-slate-100">Superadmin</h1>
          <p className="text-sm text-slate-400">Monitoreo interno - solo dev/infra</p>
        </div>

        <form onSubmit={manejarSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="********"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-md bg-amber-400 text-slate-900 py-2 text-sm font-semibold hover:bg-amber-300 disabled:opacity-60"
          >
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
