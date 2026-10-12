import { Request, Response, NextFunction } from 'express';
import { clientService } from './client.service';

export class ClientController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.body;
      const client = await clientService.createClient(req.user!, name);
      res.status(201).json({ client });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clients = await clientService.getClients(req.user!);
      res.status(200).json({ clients });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const client = await clientService.getClientById(req.user!, id);
      res.status(200).json({ client });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const { name } = req.body;
      const client = await clientService.updateClient(req.user!, id, name);
      res.status(200).json({ client });
    } catch (error) {
      next(error);
    }
  }
}

export const clientController = new ClientController();
