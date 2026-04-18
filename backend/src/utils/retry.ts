export async function callWithRetry<T>(
  fn: () => Promise<T>,
  options?: {
    retries?: number;
    baseDelayMs?: number;
    onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
  }
): Promise<T> {
  const retries = options?.retries ?? 3;
  const baseDelay = options?.baseDelayMs ?? 2000;
  const onRetry = options?.onRetry;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error: any) {
      const message = error?.message?.toLowerCase?.() || '';

      const isRetryable =
        message.includes('rate limit') ||
        message.includes('429') ||
        message.includes('tokens') ||
        message.includes('tpm') ||
        message.includes('request too large');

      if (!isRetryable || attempt === retries) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);

      console.warn(
        `[retry] attempt ${attempt} failed → retrying in ${delay}ms`
      );
      onRetry?.(attempt, delay, error);

      await new Promise((res) => setTimeout(res, delay));
    }
  }

  throw new Error('Retry failed unexpectedly');
}
