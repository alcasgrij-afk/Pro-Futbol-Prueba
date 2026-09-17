/**
 * Shimmer placeholder del tamano del contenido real (fila/card). Reemplaza
 * el texto "Cargando...": el usuario ve la forma de lo que viene, no un
 * spinner ni una linea gris generica. No-op visual con `prefers-reduced-motion`.
 */
export default function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}