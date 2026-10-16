import { ICrmAdapter } from './crm.interface';
import { MockCrmAdapter } from './mock-crm.adapter';
import { HttpCrmAdapter } from './http-crm.adapter';
import { config } from '../../config';

export function createCrmAdapter(): ICrmAdapter {
  if (config.CRM_ADAPTER === 'mock') {
    return new MockCrmAdapter();
  }

  return new HttpCrmAdapter({
    baseUrl: config.MOCK_CRM_BASE_URL,
    serviceToken: config.MOCK_CRM_SERVICE_TOKEN,
    timeoutMs: 5000,
  });
}

export const crmAdapter = createCrmAdapter();
