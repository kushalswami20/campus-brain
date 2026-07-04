import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Public } from '@/modules/auth/decorators/public.decorator';

interface HealthReport {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
  checks: Record<string, 'up' | 'down'>;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe — process is up.' })
  liveness(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — dependencies reachable.' })
  async readiness(): Promise<HealthReport> {
    const checks: Record<string, 'up' | 'down'> = { database: 'down' };

    try {
      await this.prisma.ping();
      checks.database = 'up';
    } catch {
      checks.database = 'down';
    }

    const allUp = Object.values(checks).every((state) => state === 'up');
    return {
      status: allUp ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
