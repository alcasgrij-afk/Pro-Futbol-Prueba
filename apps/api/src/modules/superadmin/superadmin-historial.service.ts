import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SuperadminService } from './superadmin.service';

const INTERVALO_MS = 30_000;
const MAX_PUNTOS = 240; // ~2h a 30s por punto

export type PuntoHistorial = Awaited<ReturnType<SuperadminService['snapshotLigero']>>;

/**
 * Buffer de tendencia en memoria, propio del proceso API: se llena solo
 * (no depende de que alguien tenga el dashboard abierto) y se comparte
 * entre todos los que vean /superadmin. Se reinicia en cada redeploy; no
 * hay tabla nueva porque el usuario pidio explicitamente no persistirlo.
 */
@Injectable()
export class SuperadminHistorialService implements OnModuleInit, OnModuleDestroy {
  private readonly puntos: PuntoHistorial[] = [];
  private intervalo?: NodeJS.Timeout;

  constructor(private readonly superadminService: SuperadminService) {}

  onModuleInit() {
    this.capturar();
    this.intervalo = setInterval(() => this.capturar(), INTERVALO_MS);
  }

  onModuleDestroy() {
    clearInterval(this.intervalo);
  }

  obtenerHistorial(): PuntoHistorial[] {
    return this.puntos;
  }

  private async capturar() {
    const punto = await this.superadminService.snapshotLigero().catch(() => null);
    if (!punto) return;
    this.puntos.push(punto);
    if (this.puntos.length > MAX_PUNTOS) this.puntos.shift();
  }
}
