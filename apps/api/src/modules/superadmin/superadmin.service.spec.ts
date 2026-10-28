import { SuperadminService } from './superadmin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

describe('SuperadminService', () => {
  let service: SuperadminService;
  let prisma: any;
  let redis: any;
  let reservasQueue: any;
  let academiaQueue: any;

  const colaVacia = () => ({
    getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, failed: 0, delayed: 0 }),
    getJobs: jest.fn().mockResolvedValue([]),
  });

  beforeEach(() => {
    prisma = {
      $queryRawUnsafe: jest.fn(),
      pago: { groupBy: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    };
    redis = { client: { ping: jest.fn().mockResolvedValue('PONG'), info: jest.fn().mockResolvedValue(''), config: jest.fn() } };
    reservasQueue = colaVacia();
    academiaQueue = colaVacia();
    service = new SuperadminService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      reservasQueue,
      academiaQueue,
    );
  });

  it('excluye la propia conexion del panel al contar conexiones usadas (pg_backend_pid)', async () => {
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ setting: '100' }]) // max_connections
      .mockResolvedValueOnce([{ count: 2n }]) // count conexiones usadas
      .mockResolvedValueOnce([]) // bloqueadas
      .mockResolvedValueOnce([]) // consulta mas lenta
      .mockResolvedValueOnce([]); // conexiones activas detalle

    const overview = await service.overview();

    const queryConteo = prisma.$queryRawUnsafe.mock.calls[1][0];
    expect(queryConteo).toContain('pid != pg_backend_pid()');
    expect(overview.database.conexiones).toEqual({ usadas: 2, max: 100 });
  });

  it('marca warn y expone la politica cuando maxmemory-policy no es noeviction y hay tope de memoria', async () => {
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ setting: '100' }])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    redis.client.config.mockImplementation((_sub: string, clave: string) =>
      Promise.resolve(clave === 'maxmemory-policy' ? ['maxmemory-policy', 'allkeys-lru'] : ['maxmemory', '104857600']),
    );

    const overview = await service.overview();

    expect(overview.redis.advertenciaEviction).toBe(true);
    expect(overview.redis.maxmemoryPolicy).toBe('allkeys-lru');
    expect(overview.redis.estado).toBe('warn');
  });

  it('no advierte eviction cuando la politica ya es noeviction', async () => {
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ setting: '100' }])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    redis.client.config.mockImplementation((_sub: string, clave: string) =>
      Promise.resolve(clave === 'maxmemory-policy' ? ['maxmemory-policy', 'noeviction'] : ['maxmemory', '104857600']),
    );

    const overview = await service.overview();

    expect(overview.redis.advertenciaEviction).toBe(false);
    expect(overview.redis.estado).toBe('ok');
  });

  it('usa el ultimo job completado como ultimaActividad de cada cola', async () => {
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ setting: '100' }])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    reservasQueue.getJobs.mockImplementation((tipos: string[]) =>
      tipos[0] === 'completed' ? Promise.resolve([{ finishedOn: 1_700_000_000_000 }]) : Promise.resolve([]),
    );

    const overview = await service.overview();

    expect(overview.colas.reservas.ultimaActividad).toBe(new Date(1_700_000_000_000).toISOString());
    expect(overview.colas.academia.ultimaActividad).toBeNull();
  });
});
