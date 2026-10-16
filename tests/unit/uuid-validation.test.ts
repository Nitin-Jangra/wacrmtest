import { describe, it, expect } from 'vitest';
import {
  UuidSchema,
  PaginationQuerySchema,
  EmployeeFilterQuerySchema,
} from '@gym-helpdesk/shared-types';

describe('Validation Schemas Unit Tests', () => {
  describe('UuidSchema', () => {
    it('should accept valid v4 UUIDs', () => {
      const valid = '11111111-1111-4000-8000-000000000001';
      expect(UuidSchema.parse(valid)).toBe(valid);
    });

    it('should reject non-UUID strings', () => {
      expect(() => UuidSchema.parse('invalid-id')).toThrow();
      expect(() => UuidSchema.parse('')).toThrow();
      expect(() => UuidSchema.parse('12345')).toThrow();
      expect(() => UuidSchema.parse('../admin')).toThrow();
    });
  });

  describe('PaginationQuerySchema', () => {
    it('should supply default page=1 and limit=20 when query is empty', () => {
      const parsed = PaginationQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
    });

    it('should parse string integers into numbers', () => {
      const parsed = PaginationQuerySchema.parse({ page: '2', limit: '50' });
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(50);
    });

    it('should reject negative or zero page values', () => {
      expect(() => PaginationQuerySchema.parse({ page: '0' })).toThrow();
      expect(() => PaginationQuerySchema.parse({ page: '-5' })).toThrow();
    });

    it('should reject limit greater than 100', () => {
      expect(() => PaginationQuerySchema.parse({ limit: '150' })).toThrow();
    });
  });

  describe('EmployeeFilterQuerySchema', () => {
    it('should parse boolean chatEligible query strings', () => {
      const parsedTrue = EmployeeFilterQuerySchema.parse({ chatEligible: 'true' });
      expect(parsedTrue.chatEligible).toBe(true);

      const parsedFalse = EmployeeFilterQuerySchema.parse({ chatEligible: 'false' });
      expect(parsedFalse.chatEligible).toBe(false);
    });

    it('should reject invalid employee status', () => {
      expect(() => EmployeeFilterQuerySchema.parse({ status: 'pending' })).toThrow();
    });
  });
});
