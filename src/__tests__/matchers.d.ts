/**
 * TypeScript declarations for custom Jest matchers
 */

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeAnonymized(original: string): R;
      toContainProxy(): R;
    }
  }
}

export {};
