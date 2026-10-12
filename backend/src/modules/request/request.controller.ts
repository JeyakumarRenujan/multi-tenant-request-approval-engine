import { Request, Response, NextFunction } from 'express';
import { requestService } from './request.service';

export class RequestController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await requestService.createRequest(req.user!, req.body);
      res.status(201).json({ request });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await requestService.getRequests(req.user!, req.query as any);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const request = await requestService.getRequestById(req.user!, id);
      res.status(200).json({ request });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const request = await requestService.updateRequest(req.user!, id, req.body);
      res.status(200).json({ request });
    } catch (error) {
      next(error);
    }
  }

  async assign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const { assigneeId, expectedVersion } = req.body;
      const request = await requestService.assignRequest(req.user!, id, assigneeId, expectedVersion);
      res.status(200).json({ request });
    } catch (error) {
      next(error);
    }
  }
}

export const requestController = new RequestController();
