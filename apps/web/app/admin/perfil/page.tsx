'use client';

import { useState } from 'react';
import { api, ApiError } from '../../../lib/api-client';

export default function PerfilPage() {
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNuevo, setPasswordNuevo] = useState('');
  const [passwordConfirmar, setPasswordConfirmar] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  async function cambiar() {
    setError(null);
    setExito(false);

    if (passwordNuevo !== passwordConfirmar) {
      setError('La confirmacion no coincide con la contrasena nueva.');
      return;
    }
    if (passwordNuevo.length < 8) {
      setError('La contrasena nueva debe tener al menos 8 caracteres.');
      return;
    }

    setGuardando(true);
    try {
      await api.cambiarPassword(passwordActual, passwordNuevo);
      setExito(true);
      setPasswordActual('');
      setPasswordNuevo('');
      setPasswordConfirmar('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contrasena.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-lg font-bold text-navy mb-6">Mi perfil</h1>

      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500">Cambiar contrasena</h2>

        <div>
          <label htmlFor="pw-actual" className="block text-sm font-medium mb-1">Contrasena actual</label>
          <input
            id="pw-actual"
            type="password"
            autoComplete="current-password"
            value={passwordActual}
            onChange={(e) => setPasswordActual(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="pw-nueva" className="block text-sm font-medium mb-1">Contrasena nueva</label>
          <input
            id="pw-nueva"
            type="password"
            autoComplete="new-password"
            value={passwordNuevo}
            onChange={(e) => setPasswordNuevo(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="pw-confirmar" className="block text-sm font-medium mb-1">Confirmar contrasena nueva</label>
          <input
            id="pw-confirmar"
            type="password"
            autoComplete="new-password"
            value={passwordConfirmar}
            onChange={(e) => setPasswordConfirmar(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red">{error}</p>}
        {exito && <p className="text-sm text-green-700">Contrasena actualizada correctamente.</p>}

        <button
          onClick={cambiar}
          disabled={guardando || !passwordActual || !passwordNuevo || !passwordConfirmar}
          className="bg-navy text-white text-sm font-semibold px-4 py-2 rounded-md disabled:opacity-50 transition-transform active:scale-[0.98]"
        >
          {guardando ? 'Guardando...' : 'Cambiar contrasena'}
        </button>
      </div>
    </div>
  );
}