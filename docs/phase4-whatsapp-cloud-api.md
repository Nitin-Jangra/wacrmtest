# Phase 4: WhatsApp Cloud API Integration — Technical Specification & Architecture

## 1. Overview

Phase 4 integrates the official **Meta WhatsApp Cloud API** with the Gym WhatsApp Helpdesk CRM backend, preserving all functionality from:
- **Phase 1:** Multi-tenant CRM mock API, CRM adapter, and branch access control.
- **Phase 2:** Supabase persistence for leads, conversations, messages, channels, and webhook events.
- **Phase 3:** Smooth Weighted Round-Robin lead assignment engine with ownership retention.

---

## 2. Architecture & Data Flow

```
                         [ Meta WhatsApp Cloud Platform ]
                                   │            ▲
        Inbound Webhooks           │            │  Outbound Messages
 (x-hub-signature-256 HMAC-SHA256) │            │  (Bearer Access Token)
                                   ▼            │
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Helpdesk Express Application                      │
 ├────────────────────────────────┬───────────────────────────────────────┤
 │ Webhook Endpoint               │ Messaging Endpoint                    │
 │ GET/POST /api/v1/webhooks/     │ POST /api/v1/conversations/:id/       │
 │          whatsapp              │      messages                         │
 └────────────────┬───────────────┴───────────────────▲───────────────────┘
                  │                                   │
                  ▼                                   │
 ┌───────────────────────────────────┐ ┌──────────────┴───────────────────┐
 │ WhatsAppWebhookService            │ │ WhatsAppMessagingService         │
 │ 1. Raw HMAC-SHA256 verification   │ │ 1. Authenticate caller identity  │
 │ 2. Idempotency (webhook_events)   │ │ 2. Authorize branch scope        │
 │ 3. Channel resolution by phone_id │ │ 3. Resolve active channel        │
 │ 4. Find/create Lead & Conv        │ │ 4. Persist outbound as pending   │
 │ 5. Trigger Phase 3 Assignment     │ │ 5. Send via IWhatsAppProvider    │
 │ 6. Monotonic Delivery Status      │ │ 6. Update message to sent        │
 └────────────────┬──────────────────┘ └──────────────┬───────────────────┘
                  │                                   │
                  ▼                                   ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                     IWhatsAppProvider Abstraction                      │
 │     ├── WhatsAppCloudApiClient (Production / Graph API v21.0)          │
 │     └── MockWhatsAppProvider (Deterministic Unit & Integration Tests)  │
 └────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Supabase Database Persistence                     │
 │  whatsapp_channels │ leads │ conversations │ messages │ webhook_events  │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 3. WhatsApp Provider Abstraction

All Meta Cloud API interactions are isolated behind the `IWhatsAppProvider` interface:

```typescript
export interface IWhatsAppProvider {
  sendTextMessage(params: SendTextMessageParams): Promise<SendTextMessageResult>;
  verifyWebhookSignature(rawBody: Buffer | string, signatureHeader?: string): boolean;
}
```

### Implementations:
1. **`WhatsAppCloudApiClient` (`apps/api/src/integrations/whatsapp/whatsapp-cloud-api.client.ts`)**:
   - Official HTTP Graph API client using native `fetch`.
   - Constructs standard endpoint: `POST https://graph.facebook.com/{apiVersion}/{phoneNumberId}/messages`.
   - Uses `Authorization: Bearer <token>` and `messaging_product: "whatsapp"`.
   - Uses Node.js `crypto.timingSafeEqual` for constant-time HMAC-SHA256 signature verification.
2. **`MockWhatsAppProvider` (`apps/api/src/integrations/whatsapp/mock-whatsapp.provider.ts`)**:
   - In-memory mock implementing `IWhatsAppProvider`.
   - Supports configurable error modes: `success`, `provider_rejection`, `network_failure`, `invalid_recipient`.
   - Captures dispatched messages in `sentMessages` array for deterministic assertions.
   - Generates valid HMAC-SHA256 signatures for testing webhook payloads.

---

## 4. Webhook Security & Verification Handshake

### 4.1 Verification Handshake (`GET /api/v1/webhooks/whatsapp`)
- Validates query parameters: `hub.mode`, `hub.verify_token`, and `hub.challenge`.
- Checks `hub.mode === 'subscribe'` and verifies `hub.verify_token === WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- On success: returns plain-text `hub.challenge` with `200 OK`.
- On token mismatch: returns `403 Forbidden` (`WEBHOOK_VERIFY_TOKEN_MISMATCH`).
- On invalid mode or missing challenge: returns `400 Bad Request`.

### 4.2 Signature Validation (`POST /api/v1/webhooks/whatsapp`)
- Validates the `x-hub-signature-256` HTTP header against the raw incoming payload bytes.
- Uses `crypto.createHmac('sha256', appSecret)` and `crypto.timingSafeEqual`.
- **Raw Body Retention:** Configured in `apps/api/src/app.ts` via `express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } })`.
- Invalid or missing signatures are rejected immediately with `403 Forbidden` (`WHATSAPP_INVALID_SIGNATURE`) before any database or business logic execution.

---

## 5. Channel Mapping & Multi-Tenant Isolation

1. Every incoming webhook message contains `metadata.phone_number_id`.
2. The `WhatsAppChannelResolver` queries the `whatsapp_channels` table:
   - Resolves the channel matching `phone_number_id`.
   - Verifies channel status is `active`.
   - Resolves the channel's `tenant_id` and `branch_id`.
3. If channel is unknown or inactive:
   - Safe error logged in `webhook_events` (`processing_status: 'ignored'`, `errorCode: 'CHANNEL_INACTIVE_OR_UNKNOWN'`).
   - Does **not** create a lead, conversation, or trigger lead assignment.
   - Returns `200 OK` acknowledgement to Meta.

---

## 6. Inbound Message Processing & Phase 3 Integration

### 6.1 Workflow
1. **Idempotency Check:** Checks `webhook_events` for `(provider, external_event_id)`. If status is `completed` or `processing`, duplicates are safely skipped.
2. **Contact & Lead Resolution:** Looks up lead by `(tenant_id, branch_id, phone_number)`. If not found, creates a new lead with `source: 'whatsapp'`.
3. **Conversation Resolution:** Looks up active conversation for `(tenant_id, branch_id, lead_id, channel_id)`. If none exists, creates one in `status: 'open'`.
4. **Message Persistence:** Inserts message record with `direction: 'inbound'`, `delivery_status: 'delivered'`, and `external_message_id: msg.id`.
5. **Phase 3 Lead Assignment:** Calls `assignmentService.assignLead(lead.id, {})`:
   - **New Contacts:** Smooth Weighted Round-Robin selects next eligible branch agent, updates `assigned_employee_id`, and appends an immutable `assignment_audit` record.
   - **Returning Contacts:** Retains existing eligible owner (`OWNER_RETAINED`) without consuming round-robin assignment weight or creating duplicate records.
6. **Webhook Acknowledgement:** Marks event `completed` in `webhook_events` and returns `200 OK`.

---

## 7. Outbound Text Messaging

### Endpoint: `POST /api/v1/conversations/:id/messages`

**Payload:**
```json
{
  "type": "text",
  "text": "Hello! How can we help you?"
}
```

**Execution Pipeline:**
1. **Authentication & Authorization:** Checks `x-mock-identity` caller context. Verifies caller belongs to conversation's `tenant_id` and `branch_id`.
2. **Channel Resolution:** Looks up conversation's `channel_id` in `whatsapp_channels`. Rejects with `422` if inactive.
3. **Recipient Resolution:** Looks up lead's phone number. Rejects with `400` if missing.
4. **Pending Persistence:** Persists outbound message in database with `delivery_status: 'pending'`.
5. **Provider Send:** Calls `provider.sendTextMessage(...)`.
6. **Status Update:** Updates message to `delivery_status: 'sent'`, records `external_message_id: 'wamid.HBgL...'`, and records `sent_at` timestamp.
7. **Error Tracking:** If provider rejects or network fails, records `delivery_status: 'failed'` and stores error metadata in `payload.sendError`.

---

## 8. Delivery-Status Monotonic Progression

Delivery receipts from Meta (`statuses` array) map to internal message statuses:
`pending` (0) ➔ `sent` (1) ➔ `delivered` (2) ➔ `read` (3)

**Rules:**
- Monotonic enforcement: Higher priority statuses cannot be overwritten by out-of-order lower priority receipts (e.g. late `delivered` receipt after `read` status).
- `failed` status can only be set from `pending` or `sent`. Once `delivered` or `read`, messages cannot regress to `failed`.
- Updates `delivered_at` and `read_at` timestamps.

---

## 9. Environment Configuration

Add the following to `.env`:

```env
# Phase 4 - WhatsApp Cloud API Configuration
WHATSAPP_PROVIDER=mock                     # 'mock' or 'meta'
WHATSAPP_ACCESS_TOKEN=EAABmock_token_here
WHATSAPP_PHONE_NUMBER_ID=109876543210987
WHATSAPP_BUSINESS_ACCOUNT_ID=waba_1234567890
WHATSAPP_API_VERSION=v21.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=gym_helpdesk_webhook_verify_token_2026
WHATSAPP_APP_SECRET=dev_whatsapp_app_secret_1234567890abcdef
```

---

## 10. Scope Boundaries

### Strictly Implemented in Phase 4:
- Official WhatsApp Cloud API provider client and mock provider.
- Webhook subscription handshake and raw HMAC-SHA256 signature verification.
- Channel-to-tenant/branch isolation via `phone_number_id`.
- Inbound text messaging and media safe handling (audio as media message).
- Outbound text messaging via `POST /api/v1/conversations/:id/messages`.
- Delivery-status monotonic updates (`sent`, `delivered`, `read`, `failed`).
- Full integration with Phase 3 SWRR lead assignment and ownership retention.
- Idempotency and safe retry processing.

### Strictly Out of Scope:
- WhatsApp voice calling.
- WhatsApp Business App coexistence.
- React frontend dashboard (Phase 5).
- External production CRM API migration (Phase 6).
- Unofficial WhatsApp automation / web scraping.
