// Thrown by server-side helpers (auth-helpers.ts, route handlers) to carry an HTTP status
// alongside the message -- caught by apiRoute() (api-route.ts) and turned into a
// { error: message } JSON response, same shape SurvivorDraft's Express error middleware
// produces and src/lib/api.ts's ApiError already expects.
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
