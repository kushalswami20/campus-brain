import { Test } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const buildController = async (
    ping: () => Promise<boolean>,
  ): Promise<HealthController> => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: { ping } }],
    }).compile();
    return moduleRef.get(HealthController);
  };

  it('liveness returns ok', async () => {
    const controller = await buildController(async () => true);
    expect(controller.liveness().status).toBe('ok');
  });

  it('readiness reports ok when the database is reachable', async () => {
    const controller = await buildController(async () => true);
    const report = await controller.readiness();
    expect(report.status).toBe('ok');
    expect(report.checks.database).toBe('up');
  });

  it('readiness reports degraded when the database ping fails', async () => {
    const controller = await buildController(async () => {
      throw new Error('connection refused');
    });
    const report = await controller.readiness();
    expect(report.status).toBe('degraded');
    expect(report.checks.database).toBe('down');
  });
});
