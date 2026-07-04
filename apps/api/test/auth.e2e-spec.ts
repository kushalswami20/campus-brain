import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Full auth lifecycle against a real database. Requires a running Postgres and
 * the JWT_* env vars (see the npm `test:e2e` invocation in the README).
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `e2e_${Date.now()}@dtu.ac.in`;
  const password = 'S3curePass!';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health', 'health/ready'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('rejects registration with a weak password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'short', fullName: 'Test User' })
      .expect(400);
  });

  let accessToken = '';
  let refreshToken = '';

  it('registers a new user and returns a token pair', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, fullName: 'Test User', branch: 'IT', semester: 6 })
      .expect(201);

    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe('STUDENT');
    expect(res.body.tokens.accessToken).toBeDefined();
    expect(res.body.tokens.refreshToken).toBeDefined();
    accessToken = res.body.tokens.accessToken;
    refreshToken = res.body.tokens.refreshToken;
  });

  it('rejects duplicate registration', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, fullName: 'Test User' })
      .expect(409);
  });

  it('blocks a protected route without a token', async () => {
    await request(app.getHttpServer()).get('/api/users/me').expect(401);
  });

  it('returns the profile with a valid access token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.email).toBe(email);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    expect(res.body.tokens.accessToken).toBeDefined();
  });

  it('rejects login with a wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'WrongPass!' })
      .expect(401);
  });

  it('rotates the refresh token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    expect(res.body.tokens.refreshToken).toBeDefined();
    expect(res.body.tokens.refreshToken).not.toBe(refreshToken);
    // The old token is now rotated; reusing it must be rejected (reuse detection).
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
