import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { convertInrToLocal, getCurrencySymbol } from '../utils/currency';

export async function getAttractions(req: Request, res: Response, next: NextFunction) {
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
      include: {
        category: true,
        city: { include: { country: true } },
      },
    });

    const normalized = attractions.map((attraction) => {
      const localCurrencyCode = attraction.city.country.currencyCode;
      const localCurrencySymbol =
        attraction.city.country.currencySymbol || getCurrencySymbol(localCurrencyCode);

      return {
        ...attraction,
        avgCostInr: attraction.avgCost,
        avgCostLocal: convertInrToLocal(attraction.avgCost, localCurrencyCode),
        localCurrencyCode,
        localCurrencySymbol,
      };
    });

    res.json(normalized);
  } catch (err) {
    next(err);
  }
}
