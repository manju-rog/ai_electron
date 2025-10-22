import request from 'supertest';
import { createApp } from '../app';

describe('server basic', () => {
  const app = createApp();

  it('/health works', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('phase', 3);
  });

  it('/chat validates', async () => {
    const r1 = await request(app).post('/chat').send({});
    expect(r1.status).toBe(400);

    const r2 = await request(app).post('/chat').send({ prompt: 'hello' });
    expect(r2.status).toBe(200);
    expect(r2.body.reply).toMatch(/hello/);
  });
});