import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';

export class UserController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.createUser(req.user!, req.body);
      res.status(201).json({ user });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await userService.getUsers(req.user!);
      res.status(200).json({ users });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const user = await userService.updateUser(req.user!, id, req.body);
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
