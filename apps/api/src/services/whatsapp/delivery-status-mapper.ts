import { DeliveryStatus } from '@gym-helpdesk/shared-types';

const STATUS_PRIORITY: Record<DeliveryStatus, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4, // Terminal error
};

/**
 * Validates whether a new status represents a valid, non-regressive transition.
 * Returns true if newStatus should be applied, false if it is an out-of-order regression.
 */
export function canTransitionStatus(
  currentStatus: DeliveryStatus,
  newStatus: DeliveryStatus,
): boolean {
  if (currentStatus === newStatus) {
    return false;
  }

  // Once read or failed, do not regress to sent or delivered
  if (currentStatus === 'read') {
    return false;
  }

  if (currentStatus === 'failed') {
    return false;
  }

  // Failed can be set from pending or sent
  if (newStatus === 'failed') {
    return currentStatus === 'pending' || currentStatus === 'sent';
  }

  return STATUS_PRIORITY[newStatus] > STATUS_PRIORITY[currentStatus];
}

/**
 * Maps Meta status string ('sent' | 'delivered' | 'read' | 'failed') to internal DeliveryStatus.
 */
export function mapMetaDeliveryStatus(metaStatus: string): DeliveryStatus {
  if (!metaStatus) return 'pending';
  switch (metaStatus.toLowerCase()) {
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'read':
      return 'read';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}
