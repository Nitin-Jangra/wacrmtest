import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import http from 'http';
import { app as mockCrmApp } from '../../apps/mock-crm-api/src/app';
import { app as helpdeskApp } from '../../apps/api/src/app';
import {
  TENANT_ALPHA_ID,
  ALPHA_BRANCH_GREATER_NOIDA_ID,
} from '../../apps/mock-crm-api/src/data/fixtures';

describe('Helpdesk API CRM Proxy Integration Tests', () => {
  let mockCrmServer: http.Server;

  beforeAll(async () => {
    // Start mock-crm-api on default port 4001 or ensure server is accessible
    await new Promise<void>((resolve) => {
      mockCrmServer = mockCrmApp.listen(4001, () => {
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      mockCrmServer.close(() => resolve());
    });
  });

  it('should verify /health reports healthy status and connected CRM', async () => {
    const res = await request(helpdeskApp).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('gym-whatsapp-helpdesk-api');
    expect(res.body.downstreamCrm.status).toBe('ok');
  });

  it('should retrieve tenants via /api/v1/crm/tenants', async () => {
    const res = await request(helpdeskApp)
      .get('/api/v1/crm/tenants')
      .set('x-mock-identity', 'super_admin');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.meta.total).toBe(2);
  });

  it('should retrieve tenant details via /api/v1/crm/tenants/:tenantId', async () => {
    const res = await request(helpdeskApp)
      .get(`/api/v1/crm/tenants/${TENANT_ALPHA_ID}`)
      .set('x-mock-identity', 'alpha_admin');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(TENANT_ALPHA_ID);
    expect(res.body.data.name).toBe('Tenant Alpha');
  });

  it('should retrieve eligible chat agents via /api/v1/crm/branches/:branchId/chat-agents', async () => {
    const res = await request(helpdeskApp)
      .get(`/api/v1/crm/branches/${ALPHA_BRANCH_GREATER_NOIDA_ID}/chat-agents`)
      .set('x-mock-identity', 'alpha_branch_admin');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].eligibilityStatus).toBe(true);
  });

  it('should propagate 403 authorization error when accessing unauthorized tenant', async () => {
    const res = await request(helpdeskApp)
      .get(`/api/v1/crm/tenants/${TENANT_ALPHA_ID}`)
      .set('x-mock-identity', 'beta_admin'); // Beta admin attempting to access Alpha
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CRM_AUTHORIZATION_ERROR');
  });
});
