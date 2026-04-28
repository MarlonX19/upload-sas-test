const prefix = "[hotelli]";

export const logger = {
  info: (...args: unknown[]) => {
    console.info(prefix, ...args);
  },
  error: (...args: unknown[]) => {
    console.error(prefix, ...args);
  },
};
