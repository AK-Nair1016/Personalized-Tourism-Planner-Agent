import { Router } from 'express';
import { getAttractions } from '../controllers/attractions.Controller';

const router = Router();
router.get('/', getAttractions);

export default router;
