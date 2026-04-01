import { Request, Response, NextFunction } from 'express';
import { runPlannerGraph } from '../graph/plannerGraph';

export async function generateItinerary(req: Request, res: Response, next: NextFunction) {
  try {
    const userProfile = req.body;
    const itinerary = await runPlannerGraph(userProfile);
    res.json(itinerary);
  } catch (err) {
    next(err);
  }
}

export async function replanItinerary(req: Request, res: Response, next: NextFunction) {
  try {
    const { itinerary_id, disruption } = req.body;

    if (!itinerary_id || !disruption) {
      return res.status(400).json({ error: 'itinerary_id and disruption are required' });
    }

    // Day 6 - wire replan logic here
    console.log('replan called:', itinerary_id, disruption);
    res.json({ message: 'Replan coming Day 6' });
  } catch (err) {
    next(err);
  }
}
