import { Request, Response, NextFunction } from 'express';
import { runPlannerGraph } from '../graph/plannerGraph';
import crypto from 'crypto';

type RequestError = Error & {
  requestId?: string;
};

export async function generateItinerary(req: Request, res: Response, next: NextFunction) {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  const startedAt = Date.now();
  res.setHeader('x-request-id', requestId);

  console.log(
    `[itinerary.generate] start requestId=${requestId} city=${req.body?.city ?? 'unknown'}`
  );

  try {
    const userProfile = req.body;
    const itinerary = await runPlannerGraph(userProfile, { requestId });
    console.log(
      `[itinerary.generate] success requestId=${requestId} durationMs=${Date.now() - startedAt}`
    );
    res.json(itinerary);
  } catch (err) {
    const error = err as RequestError;
    error.requestId = requestId;

    console.error(
      `[itinerary.generate] failed requestId=${requestId} durationMs=${Date.now() - startedAt}`
    );
    next(error);
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
