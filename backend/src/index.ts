import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import citiesRouter from './routes/cities';
import attractionsRouter from './routes/attractions';
import itineraryRouter from './routes/itinerary';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/cities', citiesRouter);
app.use('/api/attractions', attractionsRouter);
app.use('/api/itinerary', itineraryRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;