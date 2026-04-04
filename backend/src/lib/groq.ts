import Groq from 'groq-sdk';
import { loadEnv } from './env';

loadEnv();

const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim();

if (!GROQ_API_KEY) {
  throw new Error(
    'Missing GROQ_API_KEY environment variable. Set GROQ_API_KEY before starting the backend.',
  );
}

export const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || 'llama-3.1-8b-instant';

export const groq = new Groq({
  apiKey: GROQ_API_KEY,
});

export default groq;
