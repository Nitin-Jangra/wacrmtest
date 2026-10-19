import { describe, it, expect } from 'vitest';
import {
  mapMetaDeliveryStatus,
  canTransitionStatus,
} from '../../apps/api/src/services/whatsapp/delivery-status-mapper';

describe('Delivery Status Mapper & Progression Tests', () => {
  describe('mapMetaDeliveryStatus', () => {
    it('maps standard meta statuses to internal delivery status', () => {
      expect(mapMetaDeliveryStatus('sent')).toBe('sent');
      expect(mapMetaDeliveryStatus('delivered')).toBe('delivered');
      expect(mapMetaDeliveryStatus('read')).toBe('read');
      expect(mapMetaDeliveryStatus('failed')).toBe('failed');
    });

    it('falls back to pending for unknown statuses', () => {
      expect(mapMetaDeliveryStatus('unknown_status')).toBe('pending');
      expect(mapMetaDeliveryStatus(undefined as any)).toBe('pending');
    });
  });

  describe('canTransitionStatus (Monotonic progression)', () => {
    it('allows valid progressive transitions', () => {
      expect(canTransitionStatus('pending', 'sent')).toBe(true);
      expect(canTransitionStatus('pending', 'delivered')).toBe(true);
      expect(canTransitionStatus('pending', 'read')).toBe(true);
      expect(canTransitionStatus('sent', 'delivered')).toBe(true);
      expect(canTransitionStatus('sent', 'read')).toBe(true);
      expect(canTransitionStatus('delivered', 'read')).toBe(true);
    });

    it('returns false for same-status transitions (no database update needed)', () => {
      expect(canTransitionStatus('pending', 'pending')).toBe(false);
      expect(canTransitionStatus('sent', 'sent')).toBe(false);
      expect(canTransitionStatus('delivered', 'delivered')).toBe(false);
      expect(canTransitionStatus('read', 'read')).toBe(false);
      expect(canTransitionStatus('failed', 'failed')).toBe(false);
    });

    it('allows failure transition from pending and sent', () => {
      expect(canTransitionStatus('pending', 'failed')).toBe(true);
      expect(canTransitionStatus('sent', 'failed')).toBe(true);
    });

    it('rejects status regressions', () => {
      // Delivered cannot regress to sent or pending
      expect(canTransitionStatus('delivered', 'sent')).toBe(false);
      expect(canTransitionStatus('delivered', 'pending')).toBe(false);

      // Read cannot regress to delivered, sent, or pending
      expect(canTransitionStatus('read', 'delivered')).toBe(false);
      expect(canTransitionStatus('read', 'sent')).toBe(false);
      expect(canTransitionStatus('read', 'pending')).toBe(false);

      // Once delivered or read, it cannot regress to failed
      expect(canTransitionStatus('delivered', 'failed')).toBe(false);
      expect(canTransitionStatus('read', 'failed')).toBe(false);

      // Failed terminal cannot regress
      expect(canTransitionStatus('failed', 'sent')).toBe(false);
      expect(canTransitionStatus('failed', 'delivered')).toBe(false);
      expect(canTransitionStatus('failed', 'read')).toBe(false);
    });
  });
});
