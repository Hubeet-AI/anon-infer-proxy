/**
 * Jest setup file for test configuration
 */

// Set test environment variables
process.env.NODE_ENV = 'test';

// Extend Jest matchers for better error messages
expect.extend({
  toBeAnonymized(received: string, original: string) {
    const pass = received !== original && received.includes('anon_');
    
    if (pass) {
      return {
        message: () => `Expected ${received} not to be anonymized version of ${original}`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be anonymized version of ${original}`,
        pass: false,
      };
    }
  },
  
  toContainProxy(received: string) {
    const pass = /anon_[a-zA-Z0-9]+/.test(received);
    
    if (pass) {
      return {
        message: () => `Expected ${received} not to contain proxy tokens`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to contain proxy tokens`,
        pass: false,
      };
    }
  }
});

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
