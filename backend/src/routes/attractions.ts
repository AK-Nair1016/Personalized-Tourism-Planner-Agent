import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { cityId, category, maxCost } = req.query;

    if (!cityId) {
      return res.status(400).json({ error: 'cityId is required' });
    }

    const attractions = await prisma.attraction.findMany({
      where: {
        cityId: String(cityId),
        ...(category && { category: { name: String(category) } }),
        ...(maxCost && { avgCost: { lte: Number(maxCost) } }),
      },
      include: { category: true },
    });

    res.json(attractions);
  } catch (err) {
    next(err);
  }
});

export default router;