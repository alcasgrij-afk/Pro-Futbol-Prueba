'use client';

/**
 * Comparte un archivo ya generado (PDF/Excel del cierre de caja) por los
 * canales que el dispositivo ya tenga: en movil el share sheet nativo adjunta
 * el archivo real a WhatsApp/Gmail; en escritorio no existe esa API con
 * archivos, asi que se descarga y se abre WhatsApp Web con el texto para que
 * el usuario lo adjunte a mano.
 *
 * ponytail: sin gateway de WhatsApp ni SMTP — el envio lo hace el usuario
 * desde su propio WhatsApp/correo. Si algun dia se quiere envio automatico,
 * el lugar es un job del backend, no esta funcion.
 */
export async function compartirArchivo(blob: Blob, nombreArchivo: string, texto: string): Promise<'nativo' | 'descarga'> {
  const archivo = new File([blob], nombreArchivo, { type: blob.type });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombreArchivo, text: texto });
      return 'nativo';
    } catch (err) {
      // El usuario cerro el share sheet: no es un error que valga la pena
      // mostrar, pero tampoco hay que caer a la descarga como si fallara.
      if (err instanceof DOMException && err.name === 'AbortError') return 'nativo';
    }
  }

  descargar(blob, nombreArchivo);
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  return 'descarga';
}

export function descargar(blob: Blob, nombreArchivo: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
