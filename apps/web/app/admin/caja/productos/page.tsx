'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProductoCategoria, type ProductoDTO, type VentaDTO } from '@profutbol/shared-types';
import { api, ApiError } from '../../../../lib/api-client';
import ReciboImprimible from '../../../../components/ReciboImprimible';

const ETIQUETA_CATEGORIA: Record<ProductoCategoria, string> = {
  [ProductoCategoria.TIENDA]: 'Tienda',
  [ProductoCategoria.ACADEMIA]: 'Academia',
};

export default function ProductosPage() {
  const [productos, setProductos] = useState<ProductoDTO[] | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recibo, setRecibo] = useState<VentaDTO | null>(null);

  const [nuevo, setNuevo] = useState({ nombre: '', categoria: ProductoCategoria.TIENDA as ProductoCategoria, precioQ: '' });
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null);

  async function cargarProductos() {
    try {
      setProductos(await api.listarProductos());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los productos.');
    }
  }

  useEffect(() => {
    cargarProductos();
  }, []);

  useEffect(() => {
    if (recibo) window.print();
  }, [recibo]);

  const porCategoria = useMemo(() => {
    const mapa = new Map<ProductoCategoria, ProductoDTO[]>();
    for (const p of productos ?? []) {
      const lista = mapa.get(p.categoria) ?? [];
      lista.push(p);
      mapa.set(p.categoria, lista);
    }
    return mapa;
  }, [productos]);

  const totalQ = useMemo(() => {
    return (productos ?? []).reduce((acc, p) => acc + (cantidades[p.id] ?? 0) * p.precioQ, 0);
  }, [productos, cantidades]);

  function cambiarCantidad(id: string, delta: number) {
    setCantidades((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + delta) }));
  }

  async function cobrar() {
    const items = Object.entries(cantidades)
      .filter(([, cant]) => cant > 0)
      .map(([productoId, cantidad]) => ({ productoId, cantidad }));
    if (items.length === 0) {
      setError('Selecciona al menos un producto.');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const venta = await api.crearVenta({
        items,
        ...(clienteNombre.trim() ? { clienteNombre: clienteNombre.trim() } : {}),
        ...(clienteTelefono.trim() ? { clienteTelefono: clienteTelefono.trim() } : {}),
      });
      setRecibo(venta);
      setCantidades({});
      setClienteNombre('');
      setClienteTelefono('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cobrar la venta.');
    } finally {
      setCargando(false);
    }
  }

  async function agregarProducto() {
    if (!nuevo.nombre.trim() || !nuevo.precioQ || Number(nuevo.precioQ) <= 0) {
      setErrorNuevo('Nombre y precio son requeridos.');
      return;
    }
    setErrorNuevo(null);
    try {
      await api.crearProducto({ nombre: nuevo.nombre.trim(), categoria: nuevo.categoria, precioQ: Number(nuevo.precioQ) });
      setNuevo({ nombre: '', categoria: ProductoCategoria.TIENDA, precioQ: '' });
      await cargarProductos();
    } catch (err) {
      setErrorNuevo(err instanceof ApiError ? err.message : 'No se pudo agregar el producto.');
    }
  }

  async function alternarActivo(p: ProductoDTO) {
    try {
      await api.actualizarProducto(p.id, { activo: !p.activo });
      await cargarProductos();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el producto.');
    }
  }

  return (
    <div className="space-y-6 print:hidden">
      <h1 className="text-lg font-bold text-navy">Tienda — Venta de productos</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!productos ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            {[ProductoCategoria.TIENDA, ProductoCategoria.ACADEMIA].map((cat) => {
              const lista = (porCategoria.get(cat) ?? []).filter((p) => p.activo);
              if (lista.length === 0) return null;
              return (
                <div key={cat} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <h2 className="text-sm font-bold text-navy mb-3">{ETIQUETA_CATEGORIA[cat]}</h2>
                  <div className="space-y-2">
                    {lista.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 py-1">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.nombre}</p>
                          <p className="text-xs text-gray-500">Q{p.precioQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => cambiarCantidad(p.id, -1)}
                            disabled={!cantidades[p.id]}
                            className="min-h-9 min-w-9 rounded-md border border-gray-300 text-gray-600 disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-semibold">{cantidades[p.id] ?? 0}</span>
                          <button
                            onClick={() => cambiarCantidad(p.id, 1)}
                            className="min-h-9 min-w-9 rounded-md border border-gray-300 text-gray-600"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Gestion de catalogo: editar/crear precios requiere rol ADMIN en el
               backend; si un usuario de RECEPCION intenta usarla vera el 403 aqui
               mismo (no hay deteccion de rol en el frontend todavia). */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-sm font-bold text-navy mb-3">Catalogo de productos</h2>
              <div className="space-y-1.5 mb-3">
                {(productos ?? []).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 text-sm py-1 border-b border-gray-100 last:border-b-0">
                    <span className={`min-w-0 truncate ${!p.activo ? 'text-gray-400 line-through' : ''}`}>
                      {p.nombre} <span className="text-xs text-gray-400">({ETIQUETA_CATEGORIA[p.categoria]})</span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-gray-500">Q{p.precioQ}</span>
                      <button onClick={() => alternarActivo(p)} className="text-xs font-medium text-navy hover:underline">
                        {p.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 items-end">
                <input
                  type="text"
                  placeholder="Nombre"
                  value={nuevo.nombre}
                  onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                  className="min-h-10 flex-1 min-w-[140px] rounded-md border border-gray-400 px-2 text-sm"
                />
                <select
                  value={nuevo.categoria}
                  onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value as ProductoCategoria })}
                  className="min-h-10 rounded-md border border-gray-400 px-2 text-sm bg-white"
                >
                  <option value={ProductoCategoria.TIENDA}>Tienda</option>
                  <option value={ProductoCategoria.ACADEMIA}>Academia</option>
                </select>
                <input
                  type="number"
                  placeholder="Precio Q"
                  value={nuevo.precioQ}
                  onChange={(e) => setNuevo({ ...nuevo, precioQ: e.target.value })}
                  className="min-h-10 w-24 rounded-md border border-gray-400 px-2 text-sm"
                />
                <button onClick={agregarProducto} className="min-h-10 px-3 bg-navy text-white rounded-md text-sm font-semibold">
                  Agregar
                </button>
              </div>
              {errorNuevo && <p className="text-xs text-red-600 mt-1.5">{errorNuevo}</p>}
            </div>
          </div>

          {/* Resumen de cobro */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3 self-start">
            <h2 className="text-sm font-bold text-navy">Cobrar</h2>
            <label className="block text-xs font-medium text-gray-600">
              Cliente (opcional)
              <input
                type="text"
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Telefono (opcional)
              <input
                type="tel"
                value={clienteTelefono}
                onChange={(e) => setClienteTelefono(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="mt-1 w-full min-h-11 rounded-md border border-gray-400 px-3 text-sm"
              />
            </label>
            <div className="flex justify-between font-bold text-navy text-base border-t border-gray-200 pt-3">
              <span>Total</span>
              <span>Q{totalQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
            </div>
            <button
              onClick={cobrar}
              disabled={cargando || totalQ === 0}
              className="w-full min-h-11 bg-navy text-white rounded-md text-sm font-semibold disabled:opacity-50"
            >
              {cargando ? 'Cobrando...' : 'Cobrar'}
            </button>
          </div>
        </div>
      )}

      {recibo && (
        <>
          <ReciboImprimible
            titulo="Recibo de venta"
            subtitulo={recibo.cliente?.nombre}
            lineas={recibo.items.map((i) => ({
              label: i.nombreSnapshot,
              detalle: `${i.cantidad} x Q${i.precioUnitarioQ}`,
              valor: `Q${i.subtotalQ}`,
            }))}
            totalQ={recibo.montoTotalQ}
          />
          <div className="print:hidden fixed bottom-4 right-4 flex gap-2 z-50">
            <button onClick={() => window.print()} className="min-h-11 px-4 bg-navy text-white rounded-md text-sm font-semibold shadow-lg">
              Imprimir recibo
            </button>
            <button onClick={() => setRecibo(null)} className="min-h-11 px-4 bg-white border border-gray-300 rounded-md text-sm font-semibold shadow-lg">
              Cerrar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
