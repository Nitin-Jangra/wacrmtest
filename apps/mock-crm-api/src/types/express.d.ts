import { MockIdentity } from '@gym-helpdesk/shared-types';

declare global {
  namespace Express {
    interface Request {
      identity?: MockIdentity;
    }
  }
}
