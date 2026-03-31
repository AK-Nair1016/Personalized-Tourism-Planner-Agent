import Groq from 'groq-sdk';

const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim();

if (!GROQ_API_KEY) {
  throw new Error(
    'Missing GROQ_API_KEY environment variable. Set GROQ_API_KEY before starting the backend.',
  );
}

export const GROQ_MODEL = 'llama3-8b-8192';

export const groq = new Groq({
  apiKey: GROQ_API_KEY,
});

export default groq;
