export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const Errors = {
  unauthorized: (msg = "Unauthorized") =>
    new ApiError(401, "UNAUTHORIZED", msg),
  forbidden: (msg = "Forbidden") => new ApiError(403, "FORBIDDEN", msg),
  notFound: (msg = "Not found") => new ApiError(404, "NOT_FOUND", msg),
  badRequest: (msg = "Bad request", details?: unknown) =>
    new ApiError(400, "BAD_REQUEST", msg, details),
  conflict: (msg = "Conflict") => new ApiError(409, "CONFLICT", msg),
  rateLimited: (msg = "Too many requests") =>
    new ApiError(429, "RATE_LIMITED", msg),
  unavailable: (msg = "Service temporarily unavailable") =>
    new ApiError(503, "SERVICE_UNAVAILABLE", msg),
  internal: (msg = "Internal server error") =>
    new ApiError(500, "INTERNAL", msg),
};
