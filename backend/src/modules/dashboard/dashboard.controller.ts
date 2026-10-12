import { Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service';

export class DashboardController {
  async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await dashboardService.getDashboardMetrics(req.user!);
      res.status(200).json(metrics);
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
