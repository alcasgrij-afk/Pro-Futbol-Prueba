'use client';

import { useEffect, useMemo, useState } from 'react';
import { GatewayPago, ProductoCategoria, type ProductoDTO, type VentaDTO } from '@profutbol/shared-types';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { api, ApiError } from '../../../../lib/api-client';
import ReciboImprimible from '../../../../components/ReciboImprimible';

const ETIQUETA_CATEGORIA: Record<ProductoCategoria, string> = {
  [ProductoCategoria.TIENDA]: 'Tienda',
  [ProductoCategoria.ACADEMIA]: 'Academia',
};

const BILLETES_Q = [50, 100, 200];

export default function ProductosPage() {
  const [productos, setProductos] = useState<ProductoDTO[] | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<ProductoCategoria | 'TODOS'>('TODOS');

  const [clienteAbierto, setClienteAbierto] = useState(false);
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');

  const [metodoPago, setMetodoPago] = useState<GatewayPago.EFECTIVO | GatewayPago.TARJETA>(GatewayPago.EFECTIVO);
  const [codigoAutorizacion, setCodigoAutorizacion] = useState('');
  const [recibido, setRecibido] = useState('');

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

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (productos ?? []).filter(
      (p) => p.activo && (categoriaFiltro === 'TODOS' || p.categoria === categoriaFiltro) && (!q || p.nombre.toLowerCase().includes(q)),
    );
  }, [productos, busqueda, categoriaFiltro]);

  const productoPorId = useMemo(() => new Map((productos ?? []).map((p) => [p.id, p])), [productos]);

  const lineasCarrito = useMemo(
    () =>
      Object.entries(cantidades)
        .filter(([, cant]) => cant > 0)
        .map(([id, cantidad]) => ({ producto: productoPorId.get(id)!, cantidad }))
        .filter((l) => l.producto),
    [cantidades, productoPorId],
  );

  const totalQ = useMemo(() => lineasCarrito.reduce((acc, l) => acc + l.cantidad * l.producto.precioQ, 0), [lineasCarrito]);
  const cantidadArticulos = lineasCarrito.reduce((acc, l) => acc + l.cantidad, 0);

  const recibidoNumero = recibido.trim() === '' ? null : Number(recibido);
  const cambioQ = metodoPago === GatewayPago.EFECTIVO && recibidoNumero !== null ? recibidoNumero - totalQ : null;

  function cambiarCantidad(id: string, delta: number) {
    setCantidades((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + delta) }));
  }

  function vaciarCarrito() {
    setCantidades({});
    setRecibido('');
    setCodigoAutorizacion('');
  }

  function estadoBoton(): { habilitado: boolean; texto: string } {
    if (totalQ === 0) return { habilitado: false, texto: 'Agrega productos para cobrar' };
    if (metodoPago === GatewayPago.EFECTIVO && cambioQ !== null && cambioQ < 0) {
      return { habilitado: false, texto: `Falta Q${(-cambioQ).toFixed(2)}` };
    }
    return { habilitado: true, texto: `Cobrar Q${totalQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })}` };
  }

  async function cobrar() {
    if (metodoPago === GatewayPago.TARJETA && !/^\d{6,12}$/.test(codigoAutorizacion)) {
      setError('Código POS inválido (6 a 12 dígitos).');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const venta = await api.crearVenta({
        items: lineasCarrito.map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad })),
        ...(clienteNombre.trim() ? { clienteNombre: clienteNombre.trim() } : {}),
        ...(clienteTelefono.trim() ? { clienteTelefono: clienteTelefono.trim() } : {}),
        metodoPago,
        ...(metodoPago === GatewayPago.TARJETA ? { codigoAutorizacion } : {}),
      });
      setRecibo(venta);
      vaciarCarrito();
      setClienteNombre('');
      setClienteTelefono('');
      setClienteAbierto(false);
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

  const boton = estadoBoton();

  return (
    <>
    {/* El recibo vive fuera de este print:hidden (ver nota equivalente en
        admin/caja/page.tsx) para que no quede oculto por un ancestro
        display:none al imprimir. */}
    <div className="space-y-4 print:hidden pb-20 lg:pb-0">
      <h1 className="text-lg font-bold text-navy">Tienda — Venta de productos</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!productos ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
          <div className="space-y-4">
            {/* Buscador + chips de categoria */}
            <div className="space-y-3">
              <div className="relative">
                <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  placeholder="Buscar producto..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full min-h-11 rounded-md border border-gray-400 pl-9 pr-3 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(['TODOS', ProductoCategoria.TIENDA, ProductoCategoria.ACADEMIA] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoriaFiltro(cat)}
                    className={`min-h-9 px-4 rounded-full text-sm font-semibold border ${
                      categoriaFiltro === cat ? 'bg-navy border-navy text-white' : 'border-gray-300 text-navy hover:border-navy'
                    }`}
                  >
                    {cat === 'TODOS' ? 'Todos' : ETIQUETA_CATEGORIA[cat]}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid tactil: tocar un producto lo agrega a la venta */}
            {productosFiltrados.length === 0 ? (
              <p className="text-sm text-gray-500">No hay productos que coincidan con la búsqueda.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {productosFiltrados.map((p) => {
                  const qty = cantidades[p.id] ?? 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => cambiarCantidad(p.id, 1)}
                      className={`relative min-h-[108px] p-3 rounded-lg border bg-white text-left flex flex-col justify-between gap-2 transition active:scale-[.98] ${
                        qty > 0 ? 'border-2 border-navy' : 'border-gray-200 hover:border-navy'
                      }`}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 pr-6">
                        {ETIQUETA_CATEGORIA[p.categoria]}
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold leading-snug">{p.nombre}</span>
                        <span className="text-base font-bold text-navy">Q{p.precioQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
                      </span>
                      {qty > 0 && (
                        <span className="absolute top-2 right-2 min-w-[22px] h-[22px] px-1 rounded-full bg-navy text-white text-xs font-bold flex items-center justify-center">
                          {qty}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

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

          {/* Venta actual */}
          <div id="carrito" className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4 lg:sticky lg:top-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-navy">Venta actual</h2>
              {lineasCarrito.length > 0 && (
                <button onClick={vaciarCarrito} className="text-xs font-medium text-gray-500 hover:underline">
                  Vaciar
                </button>
              )}
            </div>

            {lineasCarrito.length === 0 ? (
              <p className="text-sm text-gray-500">Toca un producto para empezar la venta.</p>
            ) : (
              <div className="space-y-3">
                {lineasCarrito.map((l) => (
                  <div key={l.producto.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{l.producto.nombre}</p>
                      <p className="text-xs text-gray-500">Q{l.producto.precioQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })} c/u</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => cambiarCantidad(l.producto.id, -1)}
                        className="min-h-9 min-w-9 rounded-md border border-gray-300 text-gray-600"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">{l.cantidad}</span>
                      <button
                        onClick={() => cambiarCantidad(l.producto.id, 1)}
                        className="min-h-9 min-w-9 rounded-md border border-gray-300 text-gray-600"
                      >
                        +
                      </button>
                    </div>
                    <span className="w-16 text-right text-sm font-semibold shrink-0">
                      Q{(l.cantidad * l.producto.precioQ).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-200 pt-3 space-y-3">
              <button
                onClick={() => setClienteAbierto(!clienteAbierto)}
                className="text-xs font-semibold text-navy hover:underline"
              >
                {clienteAbierto ? '− Quitar cliente' : '+ Agregar cliente (opcional)'}
              </button>
              {clienteAbierto && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-medium text-gray-600">
                    Cliente
                    <input
                      type="text"
                      value={clienteNombre}
                      onChange={(e) => setClienteNombre(e.target.value)}
                      className="mt-1 w-full min-h-10 rounded-md border border-gray-400 px-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs font-medium text-gray-600">
                    Teléfono
                    <input
                      type="tel"
                      value={clienteTelefono}
                      onChange={(e) => setClienteTelefono(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      className="mt-1 w-full min-h-10 rounded-md border border-gray-400 px-2 text-sm"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 pt-3 space-y-3">
              <label className="block text-xs font-medium text-gray-600">
                Método de pago
                <div className="mt-1 flex gap-1 bg-gray-50 border border-gray-300 rounded-md p-1">
                  {([GatewayPago.EFECTIVO, GatewayPago.TARJETA] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetodoPago(m)}
                      className={`flex-1 min-h-9 text-xs font-semibold rounded ${metodoPago === m ? 'bg-navy text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      {m === GatewayPago.EFECTIVO ? 'Efectivo' : 'Tarjeta'}
                    </button>
                  ))}
                </div>
              </label>

              {metodoPago === GatewayPago.TARJETA ? (
                <label className="block text-xs font-medium text-gray-600">
                  Código POS (autorización)
                  <input
                    type="text"
                    inputMode="numeric"
                    value={codigoAutorizacion}
                    onChange={(e) => setCodigoAutorizacion(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    className="mt-1 w-full min-h-10 rounded-md border border-gray-400 px-2 text-sm"
                  />
                </label>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 items-end">
                    <label className="block text-xs font-medium text-gray-600">
                      Recibido
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="Q0.00"
                        value={recibido}
                        onChange={(e) => setRecibido(e.target.value)}
                        className="mt-1 w-full min-h-10 rounded-md border border-gray-400 px-2 text-sm"
                      />
                    </label>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{cambioQ !== null && cambioQ < 0 ? 'Falta' : 'Cambio'}</p>
                      <p className="text-lg font-bold text-navy">
                        {cambioQ === null ? '—' : `Q${Math.abs(cambioQ).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setRecibido(String(totalQ))}
                      className="min-h-8 px-3 rounded-full border border-gray-300 text-xs font-semibold text-navy hover:border-navy"
                    >
                      Exacto
                    </button>
                    {BILLETES_Q.filter((b) => b > totalQ).map((b) => (
                      <button
                        key={b}
                        onClick={() => setRecibido(String(b))}
                        className="min-h-8 px-3 rounded-full border border-gray-300 text-xs font-semibold text-navy hover:border-navy"
                      >
                        Q{b}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between font-bold text-navy text-base border-t border-gray-200 pt-3">
              <span>Total</span>
              <span>Q{totalQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
            </div>
            <button
              onClick={cobrar}
              disabled={cargando || !boton.habilitado}
              className="w-full min-h-11 bg-navy text-white rounded-md text-sm font-semibold disabled:opacity-50"
            >
              {cargando ? 'Cobrando...' : boton.texto}
            </button>
          </div>
        </div>
      )}
    </div>

    {/* Barra fija en pantallas angostas, igual idea que el carrito lateral pero resumida. */}
    {lineasCarrito.length > 0 && (
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-20 print:hidden bg-navy text-white px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold leading-none">Q{totalQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-white/70">{cantidadArticulos} {cantidadArticulos === 1 ? 'artículo' : 'artículos'}</p>
        </div>
        <button
          onClick={() => document.getElementById('carrito')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="min-h-10 px-4 bg-white text-navy rounded-md text-sm font-bold"
        >
          Ver venta
        </button>
      </div>
    )}

    {recibo && (
        <>
          <ReciboImprimible
            titulo="Recibo de venta"
            subtitulo={recibo.cliente?.nombre}
            numeroRecibo={recibo.numeroRecibo}
            metodoPago={recibo.gateway === GatewayPago.TARJETA ? `Tarjeta · autorización ${recibo.codigoAutorizacion ?? ''}` : 'Efectivo'}
            lineas={recibo.items.map((i) => ({
              label: i.nombreSnapshot,
              detalle: `${i.cantidad} x Q${i.precioUnitarioQ}`,
              valor: `Q${i.subtotalQ}`,
            }))}
            totalQ={recibo.montoTotalQ}
          />
          <div className="print:hidden fixed bottom-20 lg:bottom-4 right-4 flex gap-2 z-50">
            <button onClick={() => window.print()} className="min-h-11 px-4 bg-navy text-white rounded-md text-sm font-semibold shadow-lg">
              Imprimir recibo
            </button>
            <button onClick={() => setRecibo(null)} className="min-h-11 px-4 bg-white border border-gray-300 rounded-md text-sm font-semibold shadow-lg">
              Cerrar
            </button>
          </div>
        </>
      )}
    </>
  );
}
