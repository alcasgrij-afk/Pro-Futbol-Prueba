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
  umbral,
}: {
  data: number[];
  estado: 'ok' | 'warn' | 'critical';
  width?: number;
  height?: number;
  /** Valor de alerta (misma unidad que `data`). Se dibuja como linea punteada si cae dentro del rango visible. */
  umbral?: number;
}) {
  if (data.length < 2) {
    return <div style={{ width, height }} className="text-[10px] text-slate-600 flex items-center">sin datos aun</div>;
  }

  const min = Math.min(...data, umbral ?? Infinity);
  const max = Math.max(...data, umbral ?? -Infinity);
  const rango = max - min || 1;
  const yDe = (valor: number) => height - ((valor - min) / rango) * height;
  const puntos = data.map((valor, i) => `${((i / (data.length - 1)) * width).toFixed(1)},${yDe(valor).toFixed(1)}`).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {umbral !== undefined && (
        <line x1={0} y1={yDe(umbral)} x2={width} y2={yDe(umbral)} stroke="#64748b" strokeWidth={1} strokeDasharray="2,2" />
      )}
      <polyline points={puntos} fill="none" stroke={COLOR_POR_ESTADO[estado]} strokeWidth={1.5} />
      <circle cx={width} cy={yDe(data[data.length - 1])} r={2} fill={COLOR_POR_ESTADO[estado]} />
    </svg>
  );
}
