import path from 'path';
import dotenv from 'dotenv';

let envLoaded = false;

export function loadEnv() {
  if (envLoaded) return;

  const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),
  ];

  for (const candidatePath of candidatePaths) {
    const result = dotenv.config({ path: candidatePath, quiet: true });
    if (!result.error) {
      envLoaded = true;
      return;
    }
  }

  // Final fallback to dotenv default lookup behavior.
  dotenv.config({ quiet: true });
  envLoaded = true;
}
