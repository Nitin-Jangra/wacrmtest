import { config } from '../../config';
import { IWhatsAppProvider } from './whatsapp-provider.interface';
import { WhatsAppCloudApiClient } from './whatsapp-cloud-api.client';
import { MockWhatsAppProvider } from './mock-whatsapp.provider';

export * from './whatsapp-provider.interface';
export * from './whatsapp-cloud-api.client';
export * from './mock-whatsapp.provider';
export * from './whatsapp.errors';

function createDefaultProvider(): IWhatsAppProvider {
  if (config.WHATSAPP_PROVIDER === 'cloud_api' && config.WHATSAPP_ACCESS_TOKEN) {
    return new WhatsAppCloudApiClient({
      accessToken: config.WHATSAPP_ACCESS_TOKEN,
      appSecret: config.WHATSAPP_APP_SECRET,
      apiVersion: config.WHATSAPP_API_VERSION,
    });
  }
  return new MockWhatsAppProvider({
    appSecret: config.WHATSAPP_APP_SECRET,
  });
}

let activeProvider: IWhatsAppProvider = createDefaultProvider();

export function getWhatsAppProvider(): IWhatsAppProvider {
  return activeProvider;
}

export function setWhatsAppProvider(provider: IWhatsAppProvider): void {
  activeProvider = provider;
}
