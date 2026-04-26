import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import citiesRouter from './routes/cities.Routes';
import attractionsRouter from './routes/attractions.Routes';
import itineraryRouter from './routes/itinerary.Routes';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api/cities', citiesRouter);
  app.use('/api/attractions', attractionsRouter);
  app.use('/api/itinerary', itineraryRouter);

  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;
