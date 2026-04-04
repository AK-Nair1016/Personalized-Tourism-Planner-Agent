import { Request, Response, NextFunction } from 'express';
import { PipelineStageError } from '../graph/plannerGraph';

type AppError = Error & {
  requestId?: string;
  code?: unknown;
  meta?: unknown;
  failures?: unknown;
};

const MAX_LOG_MESSAGE_LENGTH = 220;

function truncateMessage(value: string) {
  if (value.length <= MAX_LOG_MESSAGE_LENGTH) return value;
  return `${value.slice(0, MAX_LOG_MESSAGE_LENGTH)}...`;
}

function parseProviderErrorFromMessage(message: string) {
  const matched = message.match(/^(\d{3})\s+(\{[\s\S]+\})$/);
  if (!matched) return null;

  const statusCode = Number(matched[1]);

  try {
    const payload = JSON.parse(matched[2]) as {
      error?: {
        code?: string;
        type?: string;
        message?: string;
      };
    };

    return {
      providerStatusCode: statusCode,
      providerErrorCode: payload.error?.code,
      providerErrorType: payload.error?.type,
      providerErrorMessage: payload.error?.message,
    };
  } catch {
    return null;
  }
}

function normalizeErrorForLog(error: unknown) {
  if (!(error instanceof Error)) {
    return { value: String(error) };
  }

  const appError = error as AppError;
  const providerError = parseProviderErrorFromMessage(appError.message);
  const normalized: Record<string, unknown> = {
    name: appError.name,
    message: truncateMessage(providerError?.providerErrorMessage ?? appError.message),
  };

  if (providerError?.providerStatusCode !== undefined) {
    normalized.providerStatusCode = providerError.providerStatusCode;
  }
  if (providerError?.providerErrorCode !== undefined) {
    normalized.providerErrorCode = providerError.providerErrorCode;
  }
  if (providerError?.providerErrorType !== undefined) {
    normalized.providerErrorType = providerError.providerErrorType;
  }

  if (appError.code !== undefined) normalized.code = appError.code;
  if (appError.meta !== undefined) normalized.meta = appError.meta;

  if (Array.isArray(appError.failures)) {
    normalized.failures = appError.failures.map((failure) => {
      if (typeof failure !== 'object' || failure === null) {
        return { value: String(failure) };
      }

      const asRecord = failure as Record<string, unknown>;
      const stage = asRecord.stage;
      const durationMs = asRecord.durationMs;
      const nestedError = asRecord.error;

      return {
        ...(typeof stage === 'string' ? { stage } : {}),
        ...(typeof durationMs === 'number' ? { durationMs } : {}),
        ...normalizeErrorForLog(nestedError),
      };
    });
  }

  return normalized;
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const appError = err as AppError;
  const requestId = appError.requestId || req.header('x-request-id') || 'n/a';
  const stage =
    appError instanceof PipelineStageError
      ? appError.stage
      : undefined;

  const payload: Record<string, unknown> = {
    requestId,
    path: req.originalUrl,
    method: req.method,
    ...normalizeErrorForLog(appError),
  };

  if (stage) payload.pipelineStage = stage;

  if (appError instanceof PipelineStageError) {
    payload.originalError = normalizeErrorForLog(appError.originalError);
  }

  console.error(`[error] ${JSON.stringify(payload)}`);

  res.status(500).json({
    error: err.message || 'Internal server error',
    requestId,
    stage,
  });
}
