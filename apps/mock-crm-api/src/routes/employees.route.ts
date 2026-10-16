import { Router, Request, Response, NextFunction } from 'express';
import { UuidSchema } from '@gym-helpdesk/shared-types';
import { crmService } from '../services/crm.service';
import { requirePermission } from '../middleware/authorize.middleware';

export const employeesRouter = Router();

// GET /api/v1/employees/:employeeId
employeesRouter.get(
  '/:employeeId',
  requirePermission('employees:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const employeeId = UuidSchema.parse(req.params.employeeId);
      const employee = await crmService.getEmployeeById(req.identity!, employeeId);
      res.status(200).json({ data: employee });
    } catch (err) {
      next(err);
    }
  },
);
