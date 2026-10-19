import { Router, Request, Response, NextFunction } from 'express';
import { whatsappWebhookService } from '../../services/whatsapp/whatsapp-webhook.service';
import { WhatsAppSignatureVerificationError } from '../../integrations/whatsapp/whatsapp.errors';

export const whatsappWebhookRouter = Router();

// GET /api/v1/webhooks/whatsapp — Meta Webhook Handshake Verification
whatsappWebhookRouter.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const mode = req.query['hub.mode'] as string | undefined;
    const token = req.query['hub.verify_token'] as string | undefined;
    const challenge = req.query['hub.challenge'] as string | undefined;

    const verifiedChallenge = whatsappWebhookService.verifySubscription(mode, token, challenge);
    res.status(200).send(verifiedChallenge);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/webhooks/whatsapp — Inbound Meta Webhook Event Notification
whatsappWebhookRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));

    // 1. Signature Validation
    const isValid = whatsappWebhookService.verifySignature(rawBody, signature);
    if (!isValid) {
      throw new WhatsAppSignatureVerificationError('Invalid or missing x-hub-signature-256 signature');
    }

    // 2. Process Webhook Event
    const result = await whatsappWebhookService.processWebhook(req.body);

    // Meta expects 200 OK acknowledgement
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});
