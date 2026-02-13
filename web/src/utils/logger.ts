/**
 * Dev-only logger — all calls are no-ops in production builds.
 * Vite tree-shakes the bodies when import.meta.env.DEV is false.
 */
export const logger = {
  error(message: string, ...args: unknown[]) {
    if (import.meta.env.DEV) {
      console.error(message, ...args);
    }
  },
  warn(message: string, ...args: unknown[]) {
    if (import.meta.env.DEV) {
      console.warn(message, ...args);
    }
  },
  log(message: string, ...args: unknown[]) {
    if (import.meta.env.DEV) {
      console.log(message, ...args);
    }
  },
};
