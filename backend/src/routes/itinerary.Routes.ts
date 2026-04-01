import { Router } from 'express';
import { generateItinerary, replanItinerary } from '../controllers/itinerary.Controller';
import { validateItineraryInput } from '../middleware/validate';

const router = Router();

router.post('/generate', validateItineraryInput, generateItinerary);
router.post('/replan', replanItinerary);

export default router;
