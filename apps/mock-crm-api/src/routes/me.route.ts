import { Router, Request, Response, NextFunction } from 'express';
import { crmService } from '../services/crm.service';

export const meRouter = Router();

meRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await crmService.getMe(req.identity!);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});
