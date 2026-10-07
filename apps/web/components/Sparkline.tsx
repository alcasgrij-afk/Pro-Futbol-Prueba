const COLOR_POR_ESTADO: Record<'ok' | 'warn' | 'critical', string> = {
  ok: '#34d399',
  warn: '#fbbf24',
  critical: '#f87171',
};

/** Linea de tendencia simple, sin dependencia de charting (SVG nativo). */
export function Sparkline({
  data,
  estado,
  width = 96,
  height = 28,
}: {
  data: number[];
  estado: 'ok' | 'warn' | 'critical';
  width?: number;
  height?: number;
}) {
  if (data.length < 2) {
    return <div style={{ width, height }} className="text-[10px] text-slate-600 flex items-center">sin datos aun</div>;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const rango = max - min || 1;
  const puntos = data
    .map((valor, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((valor - min) / rango) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={puntos} fill="none" stroke={COLOR_POR_ESTADO[estado]} strokeWidth={1.5} />
    </svg>
  );
}
