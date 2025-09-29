# Contributing to anon-infer-proxy

Thank you for your interest in contributing to `anon-infer-proxy`! This document provides guidelines and information for contributors.

## 🎯 Ways to Contribute

- **Bug Reports**: Help us identify and fix issues
- **Feature Requests**: Suggest new features and improvements
- **Code Contributions**: Submit bug fixes and new features
- **Documentation**: Improve docs, examples, and guides
- **Security**: Report vulnerabilities responsibly
- **Testing**: Help test new features and releases
- **Community**: Help other users and answer questions

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 16+ (18+ recommended)
- **npm**: Version 8+
- **Git**: Latest version
- **Docker**: For testing with Vault (optional)

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/anon-infer-proxy.git
   cd anon-infer-proxy
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Project**
   ```bash
   npm run build
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

5. **Start Development**
   ```bash
   npm run dev
   ```

### Verify Your Setup

```bash
# Run all checks
npm run lint
npm test
npm run build

# Test examples
cd examples
npm install
npm run openai:health
npm run vllm:health
```

## 📝 Development Workflow

### Branch Strategy

- **`main`**: Production-ready code
- **`develop`**: Development integration branch
- **`feature/*`**: New features
- **`fix/*`**: Bug fixes
- **`security/*`**: Security improvements
- **`docs/*`**: Documentation updates

### Workflow Steps

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Follow coding standards (see below)
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   npm run lint:fix
   npm test
   npm run build
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new anonymization strategy"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## 🎨 Coding Standards

### TypeScript Guidelines

- **Strict Mode**: All code must compile with strict TypeScript
- **Type Safety**: Prefer explicit types over `any`
- **Null Safety**: Handle null/undefined properly
- **Error Handling**: Use proper error types and try-catch blocks

```typescript
// ✅ Good
interface UserConfig {
  apiKey: string;
  timeout?: number;
}

function processConfig(config: UserConfig): Result<ProcessedConfig, ConfigError> {
  try {
    if (!config.apiKey) {
      return { success: false, error: new ConfigError('API key required') };
    }
    // ... processing
    return { success: true, data: processedConfig };
  } catch (error) {
    return { success: false, error: new ConfigError(`Processing failed: ${error.message}`) };
  }
}

// ❌ Bad
function processConfig(config: any) {
  // No error handling, uses 'any'
  return config.apiKey.toUpperCase();
}
```

### Security Guidelines

- **Input Validation**: Validate all inputs
- **Error Messages**: Don't leak sensitive information
- **Secrets**: Never hardcode secrets or sensitive data
- **Crypto**: Use established cryptographic libraries

```typescript
// ✅ Good
function validateInput(input: string): boolean {
  if (typeof input !== 'string' || input.length === 0) {
    return false;
  }
  return input.length <= MAX_INPUT_LENGTH;
}

// ❌ Bad
function validateInput(input: any) {
  return true; // No validation
}
```

### Testing Standards

- **Coverage**: Aim for >95% test coverage
- **Unit Tests**: Test individual components
- **Integration Tests**: Test component interactions
- **Security Tests**: Test security-critical functionality

```typescript
describe('AnonEngine', () => {
  let engine: AnonEngine;

  beforeEach(() => {
    engine = createAnonEngine({
      strategy: AnonymizationStrategy.HASH_SALT,
      enableSignatures: true,
      signatureSecret: 'test-secret'
    });
  });

  afterEach(() => {
    engine.dispose();
  });

  describe('anonymize', () => {
    test('should anonymize sensitive tokens', async () => {
      const prompt = 'API key: sk-1234567890abcdef';
      
      const result = await engine.anonymize(prompt);
      
      expect(result.anonPrompt).not.toContain('sk-1234567890abcdef');
      expect(result.anonPrompt).toContain('anon_');
      expect(result.mapId).toBeDefined();
      expect(result.signature).toBeDefined();
    });

    test('should handle invalid input', async () => {
      await expect(engine.anonymize('')).rejects.toThrow(ValidationError);
      await expect(engine.anonymize(null as any)).rejects.toThrow(ValidationError);
    });
  });
});
```

### Documentation Standards

- **JSDoc**: Document all public APIs
- **README**: Keep examples current
- **Type Definitions**: Export all public types
- **Examples**: Provide working code examples

```typescript
/**
 * Anonymizes sensitive tokens in the given prompt
 * 
 * @param prompt - The input prompt containing sensitive data
 * @returns Promise resolving to anonymization result with mapping info
 * 
 * @throws {ValidationError} When prompt is invalid
 * @throws {StorageError} When storage operation fails
 * 
 * @example
 * ```typescript
 * const engine = createAnonEngine();
 * const result = await engine.anonymize('API key: sk-1234567890abcdef');
 * console.log(result.anonPrompt); // "API key: anon_abc123def456"
 * ```
 */
async anonymize(prompt: string): Promise<AnonymizationResult> {
  // Implementation
}
```

## 🧪 Testing

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Specific test file
npm test -- anonEngine.test.ts

# Integration tests only
npm test -- --testPathPattern=integration
```

### Test Structure

```
src/__tests__/
├── core/
│   ├── anonEngine.test.ts
│   └── types.test.ts
├── utils/
│   ├── crypto.test.ts
│   └── tokenDetector.test.ts
├── storage/
│   ├── memoryStorage.test.ts
│   └── vaultStorage.test.ts
├── strategies/
│   ├── hashSaltStrategy.test.ts
│   └── embeddingsStrategy.test.ts
└── integration/
    └── fullWorkflow.test.ts
```

### Test Categories

1. **Unit Tests**: Individual component testing
2. **Integration Tests**: Multi-component workflows
3. **Security Tests**: Cryptographic and security validation
4. **Performance Tests**: Latency and throughput benchmarks
5. **Error Handling Tests**: Edge cases and error scenarios

### Writing Good Tests

```typescript
describe('Feature Name', () => {
  // Setup and teardown
  beforeEach(() => { /* setup */ });
  afterEach(() => { /* cleanup */ });

  describe('method name', () => {
    test('should handle normal case', () => {
      // Arrange
      const input = 'test input';
      
      // Act
      const result = processInput(input);
      
      // Assert
      expect(result).toBe('expected output');
    });

    test('should handle edge case', () => {
      // Test edge cases
    });

    test('should handle error case', () => {
      // Test error scenarios
    });
  });
});
```

## 🔒 Security Considerations

### Reporting Security Issues

**🚨 IMPORTANT**: Never create public issues for security vulnerabilities.

**For security vulnerabilities:**
- Email: security@hubeet.com
- Include: Detailed description, reproduction steps, impact assessment
- Response: We aim to respond within 24 hours

### Security Development Practices

1. **Input Validation**: Validate all external inputs
2. **Output Sanitization**: Sanitize all outputs
3. **Error Handling**: Don't leak sensitive information in errors
4. **Crypto**: Use established libraries, never roll your own crypto
5. **Dependencies**: Keep dependencies updated and audited

### Security Testing

```typescript
describe('Security Tests', () => {
  test('should not leak sensitive data in errors', () => {
    const sensitiveData = 'sk-1234567890abcdef';
    
    expect(() => {
      throw new ValidationError('Invalid input');
    }).toThrow('Invalid input'); // Generic message, no sensitive data
  });

  test('should use constant-time comparison', () => {
    const secret1 = 'secret123';
    const secret2 = 'secret456';
    
    // Should not be vulnerable to timing attacks
    const result = CryptoUtils.constantTimeCompare(secret1, secret2);
    expect(typeof result).toBe('boolean');
  });
});
```

## 📚 Documentation

### Types of Documentation

1. **API Documentation**: JSDoc comments for all public APIs
2. **Examples**: Working code examples in `/examples`
3. **Architecture**: High-level design documentation
4. **Security**: Security model and threat analysis
5. **Deployment**: Installation and deployment guides

### Documentation Guidelines

- **Clarity**: Write for users with varying experience levels
- **Examples**: Include working code examples
- **Updates**: Keep documentation in sync with code changes
- **Accessibility**: Use clear language and good structure

### Example Documentation

```typescript
/**
 * Creates a new anonymization engine with the specified configuration
 * 
 * @param config - Configuration options for the engine
 * @param config.strategy - Anonymization strategy to use ('hash_salt' or 'embeddings')
 * @param config.storage - Storage backend ('memory' or 'vault')
 * @param config.enableSignatures - Whether to enable cryptographic signatures
 * @param config.signatureSecret - Secret key for HMAC signatures (required if enableSignatures is true)
 * 
 * @returns New AnonEngine instance
 * 
 * @throws {ValidationError} When configuration is invalid
 * 
 * @example
 * ```typescript
 * // Basic configuration
 * const engine = createAnonEngine({
 *   strategy: 'hash_salt',
 *   storage: 'memory',
 *   enableSignatures: false
 * });
 * 
 * // Production configuration
 * const prodEngine = createAnonEngine({
 *   strategy: 'hash_salt',
 *   storage: 'vault',
 *   enableSignatures: true,
 *   signatureSecret: process.env.ANON_SIGNATURE_SECRET
 * });
 * ```
 */
export function createAnonEngine(config?: Partial<AnonProxyConfig>): AnonEngine {
  return new AnonEngine(config);
}
```

## 🚀 Pull Request Process

### Before Submitting

1. **Code Quality**
   ```bash
   npm run lint:fix
   npm test
   npm run build
   ```

2. **Documentation**
   - Update JSDoc comments
   - Add examples if needed
   - Update README if API changes

3. **Tests**
   - Add tests for new functionality
   - Ensure all tests pass
   - Maintain >95% coverage

### PR Guidelines

1. **Title**: Use conventional commit format
   - `feat: add embeddings anonymization strategy`
   - `fix: resolve vault connection timeout issue`
   - `docs: update API documentation`
   - `security: improve input validation`

2. **Description**: Include:
   - **What**: What changes were made
   - **Why**: Why the changes were necessary
   - **How**: How the changes work
   - **Testing**: How the changes were tested

3. **Scope**: Keep PRs focused and atomic
   - One feature/fix per PR
   - Avoid mixing unrelated changes

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Security improvement

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Security tests pass
- [ ] Manual testing completed

## Security Impact
- [ ] No security impact
- [ ] Security enhancement
- [ ] Requires security review

## Documentation
- [ ] Code comments updated
- [ ] README updated
- [ ] Examples updated
- [ ] API docs updated

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated Checks**: CI/CD pipeline runs automatically
2. **Code Review**: Maintainers review code quality and design
3. **Security Review**: Security-sensitive changes get extra review
4. **Testing**: Changes are tested in multiple environments
5. **Approval**: At least one maintainer approval required
6. **Merge**: Squash and merge to main branch

## 🤝 Community Guidelines

### Code of Conduct

- **Respectful**: Treat everyone with respect and kindness
- **Inclusive**: Welcome people of all backgrounds and experience levels
- **Constructive**: Provide helpful, constructive feedback
- **Patient**: Help newcomers learn and grow
- **Professional**: Maintain professional communication

### Communication

- **Issues**: Use GitHub issues for bug reports and feature requests
- **Discussions**: Use GitHub discussions for questions and ideas
- **Security**: Use email for security vulnerabilities
- **Community**: Join community discussions and help others

### Getting Help

- **Documentation**: Check the README and docs first
- **Search**: Search existing issues and discussions
- **Ask**: Create a new issue or discussion if needed
- **Community**: Other community members are often happy to help

## 🏆 Recognition

### Contributors

We recognize contributors in several ways:

- **Contributors List**: Listed in README and releases
- **Commit Attribution**: Proper git attribution maintained
- **Release Notes**: Major contributions mentioned in releases
- **Community Recognition**: Thanks in discussions and social media

### Types of Contributions

All contributions are valuable:

- **Code**: Bug fixes, features, performance improvements
- **Documentation**: Guides, examples, API docs
- **Testing**: Test cases, bug reports, QA
- **Design**: UX/UI improvements, architecture input
- **Community**: Helping users, answering questions
- **Security**: Vulnerability reports, security reviews

## 📋 Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks
- **security**: Security improvements
- **perf**: Performance improvements

### Examples

```bash
feat: add embeddings anonymization strategy
fix: resolve vault connection timeout
docs: update API documentation
security: improve input validation
test: add integration tests for vault storage
chore: update dependencies
```

### Scope Examples

```bash
feat(core): add new anonymization engine
fix(storage): resolve vault timeout issue
docs(examples): add OpenAI integration guide
security(crypto): improve HMAC validation
```

## 🎉 Getting Started Quickly

### First Contribution

1. **Pick a Good First Issue**
   - Look for `good first issue` label
   - Start with documentation or tests
   - Ask questions if unclear

2. **Small Changes First**
   - Fix typos or improve examples
   - Add test cases
   - Improve error messages

3. **Follow the Process**
   - Create a fork
   - Make a focused change
   - Write tests
   - Submit a PR

### Example First PR

```bash
# Fix a typo in documentation
git checkout -b docs/fix-readme-typo
# Edit README.md to fix typo
git add README.md
git commit -m "docs: fix typo in installation section"
git push origin docs/fix-readme-typo
# Create PR on GitHub
```

## ❓ FAQ

### Q: How do I add a new anonymization strategy?

A: Implement the `AnonymizationStrategyInterface` and add tests. See `HashSaltStrategy` as an example.

### Q: How do I add a new storage backend?

A: Implement the `StorageInterface` and add comprehensive tests. See `MemoryStorage` and `VaultStorage` as examples.

### Q: How do I report a security vulnerability?

A: Email security@hubeet.com with details. Do NOT create public issues for vulnerabilities.

### Q: How do I add a new token detection pattern?

A: Add patterns to `TOKEN_PATTERNS` in `tokenDetector.ts` and add tests to verify detection.

### Q: How do I test with Vault?

A: Use Docker Compose: `docker-compose up vault` then run tests with Vault environment variables.

### Q: What's the release process?

A: Releases are automated via GitHub Actions when tags are pushed. See `.github/workflows/release.yml`.

## 📞 Contact

- **General Questions**: GitHub Discussions
- **Bug Reports**: GitHub Issues
- **Security Issues**: security@hubeet.com
- **Feature Requests**: GitHub Issues
- **Community**: GitHub Discussions

Thank you for contributing to anon-infer-proxy! 🎉
