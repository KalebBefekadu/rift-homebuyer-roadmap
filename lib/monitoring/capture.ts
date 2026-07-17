import * as Sentry from "@sentry/nextjs";

/** Capture operational failures (sync, PDF, etc.) with context — never silent. */
export function captureOpError(
  error: unknown,
  context: {
    op: string;
    extra?: Record<string, unknown>;
  },
): void {
  Sentry.withScope((scope) => {
    scope.setTag("op", context.op);
    if (context.extra) {
      scope.setExtras(context.extra);
    }
    Sentry.captureException(error);
  });
  if (process.env.NODE_ENV === "development") {
    console.error(`[${context.op}]`, error, context.extra);
  }
}
