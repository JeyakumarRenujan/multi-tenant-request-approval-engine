import { Request, Response, NextFunction } from 'express';
import { organizationService } from './organization.service';

export class OrganizationController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.body;
      const organization = await organizationService.createOrganization(name);
      res.status(201).json({ organization });
    } catch (error) {
      next(error);
    }
  }

  async getAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizations = await organizationService.getOrganizations();
      res.status(200).json({ organizations });
    } catch (error) {
      next(error);
    }
  }
}

export const organizationController = new OrganizationController();
