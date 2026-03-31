import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const cities = await prisma.city.findMany({
      include: { country: true },
    });
    res.json(cities);
  } catch (err) {
    next(err);
  }
});

export default router;