import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export async function getCities(req: Request, res: Response, next: NextFunction) {
  try {
    const cities = await prisma.city.findMany({
      include: { country: true },
    });
    res.json(cities);
  } catch (err) {
    next(err);
  }
}
