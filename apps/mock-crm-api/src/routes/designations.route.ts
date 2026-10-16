import { Router, Request, Response, NextFunction } from 'express';
import { UuidSchema } from '@gym-helpdesk/shared-types';
import { crmService } from '../services/crm.service';
import { requirePermission } from '../middleware/authorize.middleware';

export const designationsRouter = Router();

// GET /api/v1/chat-designations/:designationId
designationsRouter.get(
  '/:designationId',
  requirePermission('designations:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const designationId = UuidSchema.parse(req.params.designationId);
      const designation = await crmService.getDesignationById(req.identity!, designationId);
      res.status(200).json({ data: designation });
    } catch (err) {
      next(err);
    }
  },
);
