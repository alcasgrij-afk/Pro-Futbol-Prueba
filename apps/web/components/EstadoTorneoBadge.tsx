import { EstadoTorneo } from '@profutbol/shared-types';

const ETIQUETA_ESTADO: Record<EstadoTorneo, string> = {
  [EstadoTorneo.PROXIMO]: 'Próximo',
  [EstadoTorneo.INSCRIPCIONES_ABIERTAS]: 'Inscripciones abiertas',
  [EstadoTorneo.EN_CURSO]: 'En curso',
  [EstadoTorneo.FINALIZADO]: 'Finalizado',
  [EstadoTorneo.CANCELADO]: 'Cancelado',
};

const COLOR_ESTADO: Record<EstadoTorneo, string> = {
  [EstadoTorneo.PROXIMO]: 'bg-gray-100 text-gray-600',
  [EstadoTorneo.INSCRIPCIONES_ABIERTAS]: 'bg-yellow-100 text-yellow-800',
  [EstadoTorneo.EN_CURSO]: 'bg-blue-100 text-blue-800',
  [EstadoTorneo.FINALIZADO]: 'bg-green-100 text-green-800',
  [EstadoTorneo.CANCELADO]: 'bg-red-100 text-red-700',
};

export default function EstadoTorneoBadge({ estado }: { estado: EstadoTorneo }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${COLOR_ESTADO[estado]}`}>
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}
