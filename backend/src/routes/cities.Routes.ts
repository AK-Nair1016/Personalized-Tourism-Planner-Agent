import { Router } from 'express';
import { getCities } from '../controllers/cities.Controller';

const router = Router();
router.get('/', getCities);

export default router;
