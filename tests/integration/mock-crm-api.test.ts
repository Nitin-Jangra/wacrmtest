import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../apps/mock-crm-api/src/app';
import {
  TENANT_ALPHA_ID,
  ALPHA_BRANCH_GREATER_NOIDA_ID,
  ALPHA_DESIG_EXEC_ID,
} from '../../apps/mock-crm-api/src/data/fixtures';

describe('Mock CRM API Integration Tests', () => {
  describe('GET /health', () => {
    it('should return service health without authentication', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('mock-crm-api');
      expect(res.body.version).toBe('1.0.0');
    });
  });

  describe('GET /api/v1/me', () => {
    it('should return 401 when x-mock-identity header is missing', async () => {
      const res = await request(app).get('/api/v1/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('MISSING_IDENTITY');
    });

    it('should return current identity and permissions for super_admin', async () => {
      const res = await request(app).get('/api/v1/me').set('x-mock-identity', 'super_admin');
      expect(res.status).toBe(200);
      expect(res.body.data.identity.key).toBe('super_admin');
      expect(res.body.data.scope.isSuperAdmin).toBe(true);
      expect(res.body.data.scope.allowedPermissions).toContain('tenants:read');
    });

    it('should return current identity and tenant scope for alpha_admin', async () => {
      const res = await request(app).get('/api/v1/me').set('x-mock-identity', 'alpha_admin');
      expect(res.status).toBe(200);
      expect(res.body.data.identity.key).toBe('alpha_admin');
      expect(res.body.data.scope.authorizedTenantId).toBe(TENANT_ALPHA_ID);
    });
  });

  describe('GET /api/v1/tenants', () => {
    it('should return all tenants with pagination envelope for super_admin', async () => {
      const res = await request(app)
        .get('/api/v1/tenants?page=1&limit=10')
        .set('x-mock-identity', 'super_admin');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
    });

    it('should return single authorized tenant for alpha_admin', async () => {
      const res = await request(app).get('/api/v1/tenants').set('x-mock-identity', 'alpha_admin');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(TENANT_ALPHA_ID);
    });
  });

  describe('GET /api/v1/tenants/:tenantId', () => {
    it('should return tenant details for authorized identity', async () => {
      const res = await request(app)
        .get(`/api/v1/tenants/${TENANT_ALPHA_ID}`)
        .set('x-mock-identity', 'alpha_admin');
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(TENANT_ALPHA_ID);
      expect(res.body.data.name).toBe('Tenant Alpha');
    });

    it('should return 404 for non-existent UUID', async () => {
      const res = await request(app)
        .get('/api/v1/tenants/99999999-9999-4000-8000-999999999999')
        .set('x-mock-identity', 'super_admin');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 for malformed UUID', async () => {
      const res = await request(app)
        .get('/api/v1/tenants/malformed-id')
        .set('x-mock-identity', 'super_admin');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/tenants/:tenantId/branches', () => {
    it('should list branches for Tenant Alpha', async () => {
      const res = await request(app)
        .get(`/api/v1/tenants/${TENANT_ALPHA_ID}/branches`)
        .set('x-mock-identity', 'alpha_admin');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(2);
    });
  });

  describe('GET /api/v1/branches/:branchId', () => {
    it('should retrieve branch by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/branches/${ALPHA_BRANCH_GREATER_NOIDA_ID}`)
        .set('x-mock-identity', 'alpha_branch_admin');
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Alpha — Greater Noida');
    });
  });

  describe('GET /api/v1/branches/:branchId/employees', () => {
    it('should list employees for the branch', async () => {
      const res = await request(app)
        .get(`/api/v1/branches/${ALPHA_BRANCH_GREATER_NOIDA_ID}/employees`)
        .set('x-mock-identity', 'alpha_branch_admin');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(4);
    });

    it('should filter branch employees by status', async () => {
      const res = await request(app)
        .get(`/api/v1/branches/${ALPHA_BRANCH_GREATER_NOIDA_ID}/employees?status=active`)
        .set('x-mock-identity', 'alpha_branch_admin');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
    });
  });

  describe('GET /api/v1/branches/:branchId/chat-agents', () => {
    it('should return eligible chat agents with designation info', async () => {
      const res = await request(app)
        .get(`/api/v1/branches/${ALPHA_BRANCH_GREATER_NOIDA_ID}/chat-agents`)
        .set('x-mock-identity', 'alpha_branch_admin');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0]).toHaveProperty('designationName');
      expect(res.body.data[0].eligibilityStatus).toBe(true);
      expect(res.body.data[0].employeeStatus).toBe('active');
    });
  });

  describe('GET /api/v1/chat-designations/:designationId', () => {
    it('should retrieve designation by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/chat-designations/${ALPHA_DESIG_EXEC_ID}`)
        .set('x-mock-identity', 'alpha_admin');
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(ALPHA_DESIG_EXEC_ID);
      expect(res.body.data.name).toBe('Chat Support Executive');
    });
  });
});
