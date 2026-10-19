import { describe, it, expect, beforeEach } from 'vitest';
import { WhatsAppCloudApiClient } from '../../apps/api/src/integrations/whatsapp/whatsapp-cloud-api.client';
import { MockWhatsAppProvider } from '../../apps/api/src/integrations/whatsapp/mock-whatsapp.provider';
import {
  WhatsAppProviderError,
  WhatsAppInvalidRecipientError,
} from '../../apps/api/src/integrations/whatsapp/whatsapp.errors';

describe('WhatsApp Provider Client & Mock Tests', () => {
  const testAccessToken = 'EAABmock_token_for_unit_tests';
  const testAppSecret = 'test_app_secret_1234567890abcdef';
  const testPhoneNumberId = '109876543210987';

  describe('WhatsAppCloudApiClient', () => {
    it('initializes with configuration parameters', () => {
      const client = new WhatsAppCloudApiClient({
        accessToken: testAccessToken,
        appSecret: testAppSecret,
        apiVersion: 'v20.0',
      });
      expect(client).toBeDefined();
    });

    it('verifies valid HMAC-SHA256 signatures', () => {
      const client = new WhatsAppCloudApiClient({
        accessToken: testAccessToken,
        appSecret: testAppSecret,
        apiVersion: 'v20.0',
      });

      const body = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }));
      const validSignature = MockWhatsAppProvider.generateSignature(body, testAppSecret);

      expect(client.verifySignature(body, validSignature)).toBe(true);
    });

    it('rejects tampered body or invalid signature', () => {
      const client = new WhatsAppCloudApiClient({
        accessToken: testAccessToken,
        appSecret: testAppSecret,
        apiVersion: 'v20.0',
      });

      const body = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }));
      const tamperedBody = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account', tampered: true }));
      const validSignature = MockWhatsAppProvider.generateSignature(body, testAppSecret);

      // Tampered body with signature of original body
      expect(client.verifySignature(tamperedBody, validSignature)).toBe(false);

      // Wrong signature format
      expect(client.verifySignature(body, 'invalid_sig')).toBe(false);
      expect(client.verifySignature(body, 'sha256=abcdef')).toBe(false);
      expect(client.verifySignature(body, undefined)).toBe(false);
    });

    it('rejects signature generated with a different secret', () => {
      const client = new WhatsAppCloudApiClient({
        accessToken: testAccessToken,
        appSecret: testAppSecret,
        apiVersion: 'v20.0',
      });

      const body = Buffer.from(JSON.stringify({ test: 123 }));
      const wrongSecretSignature = MockWhatsAppProvider.generateSignature(body, 'wrong_secret_123');

      expect(client.verifySignature(body, wrongSecretSignature)).toBe(false);
    });

    it('throws when sending without access token', async () => {
      const client = new WhatsAppCloudApiClient({
        accessToken: '',
        appSecret: testAppSecret,
        apiVersion: 'v20.0',
      });

      await expect(
        client.sendTextMessage({
          phoneNumberId: testPhoneNumberId,
          to: '+15551234567',
          text: 'Hello test',
        }),
      ).rejects.toThrow(WhatsAppProviderError);
    });
  });

  describe('MockWhatsAppProvider', () => {
    let mockProvider: MockWhatsAppProvider;

    beforeEach(() => {
      mockProvider = new MockWhatsAppProvider(testAppSecret);
    });

    it('successfully dispatches text message and records in sentMessages queue', async () => {
      const result = await mockProvider.sendTextMessage({
        phoneNumberId: testPhoneNumberId,
        to: '+15551234567',
        text: 'Hello gym member!',
      });

      expect(result.messageId).toBeDefined();
      expect(result.messageId).toMatch(/^wamid\./);

      const sent = mockProvider.getSentMessages();
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({
        phoneNumberId: testPhoneNumberId,
        to: '+15551234567',
        text: 'Hello gym member!',
        messageId: result.messageId,
      });
    });

    it('simulates provider rejection error mode', async () => {
      mockProvider.setErrorMode('provider_rejection');

      await expect(
        mockProvider.sendTextMessage({
          phoneNumberId: testPhoneNumberId,
          to: '+15551234567',
          text: 'Should fail',
        }),
      ).rejects.toThrow(WhatsAppProviderError);
    });

    it('simulates network failure error mode', async () => {
      mockProvider.setErrorMode('network_failure');

      await expect(
        mockProvider.sendTextMessage({
          phoneNumberId: testPhoneNumberId,
          to: '+15551234567',
          text: 'Should fail',
        }),
      ).rejects.toThrow(WhatsAppProviderError);
    });

    it('simulates invalid recipient error mode', async () => {
      mockProvider.setErrorMode('invalid_recipient');

      await expect(
        mockProvider.sendTextMessage({
          phoneNumberId: testPhoneNumberId,
          to: '+15551234567',
          text: 'Should fail',
        }),
      ).rejects.toThrow(WhatsAppInvalidRecipientError);
    });

    it('generates verifiable webhook signatures with default secret', () => {
      const payload = Buffer.from(JSON.stringify({ event: 'ping' }));
      const signature = mockProvider.generateSignature(payload);

      expect(mockProvider.verifySignature(payload, signature)).toBe(true);
      expect(mockProvider.verifySignature(payload, 'sha256=invalid')).toBe(false);
    });
  });
});
