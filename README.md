# 🔐 anon-infer-proxy

**Secure anonymization proxy for LLM inference** - Never expose sensitive tokens to external AI services again.

[![npm version](https://badge.fury.io/js/anon-infer-proxy.svg)](https://badge.fury.io/js/anon-infer-proxy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/Hubeet-AI/anon-infer-proxy/workflows/CI/badge.svg)](https://github.com/Hubeet-AI/anon-infer-proxy/actions)
[![Coverage Status](https://coveralls.io/repos/github/hubeet/anon-infer-proxy/badge.svg?branch=main)](https://coveralls.io/github/hubeet/anon-infer-proxy?branch=main)

## 🎯 What is anon-infer-proxy?

`anon-infer-proxy` is a TypeScript/Node.js library that allows you to safely use external LLM services (OpenAI, Anthropic, etc.) without exposing sensitive information like API keys, credentials, emails, or personal data.

### 🔍 The Problem

When using external LLM services, you often need to include sensitive information in your prompts:

```javascript
const prompt = `
  Help me debug this API connection:
  - API Key: sk-1234567890abcdef
  - Database: postgresql://admin:secret@db.company.com/prod
  - Admin email: admin@company.com
`;

// ❌ This sends sensitive data to external service!
const response = await openai.chat.completions.create({
  messages: [{ role: 'user', content: prompt }]
});
```

### ✅ The Solution

`anon-infer-proxy` automatically detects and anonymizes sensitive tokens before sending to external services:

```javascript
const engine = createAnonEngine();

// 🔒 Anonymize sensitive data
const { anonPrompt, mapId, signature } = await engine.anonymize(prompt);
// Result: "API Key: anon_abc123, Database: anon_def456, Admin email: anon_ghi789"

// 🤖 Safe to send to external service
const response = await openai.chat.completions.create({
  messages: [{ role: 'user', content: anonPrompt }]
});

// 🔓 Restore original data in response
const finalResponse = await engine.deanonymize(
  response.choices[0].message.content, 
  mapId, 
  signature
);
```

## 🚀 Quick Start

### Installation

```bash
npm install anon-infer-proxy
```

### Basic Usage

```typescript
import { createAnonEngine } from 'anon-infer-proxy';

// Create anonymization engine
const engine = createAnonEngine({
  strategy: 'hash_salt',      // or 'embeddings'
  storage: 'memory',          // or 'vault'
  enableSignatures: true,
  signatureSecret: 'your-secret-key'
});

// Anonymize prompt
const prompt = 'My API key is sk-1234567890abcdef';
const result = await engine.anonymize(prompt);
console.log(result.anonPrompt); // "My API key is anon_abc123def456"

// Send anonymized prompt to external service
const llmResponse = await callExternalLLM(result.anonPrompt);

// Restore original data
const finalResponse = await engine.deanonymize(
  llmResponse, 
  result.mapId, 
  result.signature
);

engine.dispose();
```

### OpenAI Integration

```typescript
import { SecureOpenAI } from 'anon-infer-proxy/examples/openai-integration';

const secureAI = new SecureOpenAI(process.env.OPENAI_API_KEY);

const response = await secureAI.createSecureChatCompletion({
  messages: [{
    role: 'user',
    content: 'Help me with API key sk-1234567890abcdef and email admin@company.com'
  }]
});

// Response automatically has sensitive data restored
console.log(response.choices[0].message.content);
```

## 🏗️ Architecture

```mermaid
flowchart LR
    A[Original Prompt] --> B[Token Detection]
    B --> C[Anonymization]
    C --> D[External LLM]
    D --> E[Deanonymization]
    E --> F[Final Response]
    
    C -.-> G[Secure Storage]
    E -.-> G
    
    subgraph "Your Environment"
        A
        B
        C
        E
        F
        G
    end
    
    subgraph "External Service"
        D
    end
```

### Data Flow

1. **📥 Input**: Your prompt with sensitive data
2. **🔍 Detection**: Automatically identify sensitive tokens (API keys, emails, IPs, etc.)
3. **🔒 Anonymization**: Replace sensitive tokens with secure proxies
4. **🤖 Inference**: Send anonymized prompt to external LLM service
5. **🔓 Deanonymization**: Restore original tokens in the response
6. **📤 Output**: Final response with your sensitive data intact

## 🛡️ Security Features

### 🔐 Multiple Anonymization Strategies

- **Hash + Salt**: Fast, reversible, deterministic (default)
- **Embeddings**: Semantic-preserving, irreversible (advanced)

### 🏪 Secure Storage Options

- **Memory**: Fast, development-friendly (default)
- **HashiCorp Vault**: Production-ready, encrypted at rest

### ✍️ Cryptographic Signatures

- **HMAC Validation**: Ensure mapping data hasn't been tampered with
- **Replay Attack Protection**: Prevent reuse of old mappings
- **Data Integrity**: Verify responses match original prompts

### 🕵️ Comprehensive Token Detection

Automatically detects 15+ types of sensitive data:

| Token Type | Examples |
|------------|----------|
| **API Keys** | `sk-1234567890abcdef`, `api_key_abc123` |
| **JWT Tokens** | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` |
| **Email Addresses** | `user@company.com`, `admin@example.org` |
| **Phone Numbers** | `+1-555-123-4567`, `(555) 123-4567` |
| **IP Addresses** | `192.168.1.100`, `10.0.0.1` |
| **Database URLs** | `postgresql://user:pass@host/db` |
| **UUIDs** | `550e8400-e29b-41d4-a716-446655440000` |
| **AWS Keys** | `AKIAIOSFODNN7EXAMPLE` |
| **Bearer Tokens** | `Bearer abc123def456` |
| **Credit Cards** | `4111-1111-1111-1111` |
| **SSNs** | `123-45-6789` |
| **Custom Patterns** | Define your own sensitive patterns |

## 📦 Installation & Setup

### Node.js/TypeScript

```bash
npm install anon-infer-proxy
```

### Python (via wrapper)

```bash
# Install the package
npm install anon-infer-proxy

# Use the Python wrapper
python3 examples/python-wrapper.py
```

### Docker

```bash
# Clone the repository
git clone https://github.com/Hubeet-AI/anon-infer-proxy.git
cd anon-infer-proxy

# Run with Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t anon-infer-proxy .
docker run -p 3000:3000 anon-infer-proxy
```

### Vault Setup (Optional)

For production environments, use HashiCorp Vault for secure storage:

```bash
# Start Vault server
docker-compose up vault

# Initialize Vault (automated)
docker-compose run vault-init

# Set environment variables
export VAULT_TOKEN="your-vault-token"
export VAULT_ENDPOINT="http://localhost:8200"
```

## 🔧 Configuration

### Basic Configuration

```typescript
import { createAnonEngine, AnonymizationStrategy, StorageBackend } from 'anon-infer-proxy';

const engine = createAnonEngine({
  // Anonymization strategy
  strategy: AnonymizationStrategy.HASH_SALT,
  
  // Storage backend
  storage: StorageBackend.MEMORY,
  
  // Security settings
  enableSignatures: true,
  signatureSecret: 'your-secret-key',
  
  // Logging (disable in production)
  enableLogging: false,
  
  // Custom salt for hashing
  customSalt: 'your-custom-salt'
});
```

### Environment Variables

```bash
# Vault configuration
VAULT_ENDPOINT=http://localhost:8200
VAULT_TOKEN=your-vault-token
VAULT_MOUNT_PATH=secret
VAULT_VERIFY_TLS=true

# Signature secret
ANON_SIGNATURE_SECRET=your-hmac-secret

# Service configuration
NODE_ENV=production
```

### Preset Configurations

```typescript
import { DEFAULT_CONFIGS } from 'anon-infer-proxy';

// Development - Fast, memory-based, with logging
const devEngine = createAnonEngine(DEFAULT_CONFIGS.DEVELOPMENT);

// Production - Vault storage, signatures enabled
const prodEngine = createAnonEngine(DEFAULT_CONFIGS.PRODUCTION);

// High Security - Embeddings + Vault + Signatures
const secureEngine = createAnonEngine(DEFAULT_CONFIGS.HIGH_SECURITY);
```

## 🎯 Use Cases

### 1. Customer Support Systems

```typescript
const supportPrompt = `
  Customer issue:
  - Email: john.doe@customer.com
  - Phone: +1-555-123-4567
  - API Key: sk-live_1234567890abcdef
  - Account: cust_abc123def456
  
  Issue: API calls returning 401 errors
`;

const { anonPrompt, mapId } = await engine.anonymize(supportPrompt);
// Safe to send to external AI for help
```

### 2. Code Review & Security Analysis

```typescript
const codePrompt = `
  Review this configuration for security issues:
  
  const config = {
    apiKey: 'sk-1234567890abcdef',
    dbUrl: 'postgresql://admin:secret@db.company.com/prod',
    adminEmail: 'admin@company.com'
  };
`;

// AI can review code structure without seeing actual credentials
```

### 3. Infrastructure Planning

```typescript
const infraPrompt = `
  Plan deployment for:
  - AWS Access Key: AKIAIOSFODNN7EXAMPLE
  - Database: mysql://root:password@10.0.1.100:3306/prod
  - Admin SSH: ssh admin@10.0.1.200 -i ~/.ssh/prod_key
`;

// Get infrastructure advice without exposing real credentials
```

### 4. Data Migration Scripts

```typescript
const migrationPrompt = `
  Generate migration script:
  - Source: mongodb://user:pass@source.db.com/olddb
  - Target: postgresql://admin:secret@target.db.com/newdb
  - Notification: alerts@company.com
`;

// AI helps with migration logic without accessing real databases
```

## 🔌 Integrations

### OpenAI (GPT-3.5, GPT-4)

```typescript
import { SecureOpenAI } from 'anon-infer-proxy/examples/openai-integration';

const secureAI = new SecureOpenAI(process.env.OPENAI_API_KEY, {
  model: 'gpt-4',
  enableSignatures: true
});

const response = await secureAI.createSecureChatCompletion({
  messages: [{ role: 'user', content: promptWithSecrets }]
});
```

### vLLM (Self-hosted models)

```typescript
import { SecurevLLM } from 'anon-infer-proxy/examples/vllm-integration';

const secureLLM = new SecurevLLM('http://localhost:8000', {
  model: 'llama-2-7b-chat'
});

const response = await secureLLM.generateSecure({
  prompt: promptWithSecrets,
  options: { maxTokens: 150 }
});
```

### Python Applications

```python
from examples.python_wrapper import AnonInferProxy

proxy = AnonInferProxy(
    strategy="hash_salt",
    enable_signatures=True,
    signature_secret="your-secret"
)

result = proxy.anonymize("API key: sk-1234567890abcdef")
# Use result.anon_prompt with your AI service
response = proxy.deanonymize(ai_response, result.map_id, result.signature)
```

### Custom Integrations

```typescript
// Generic pattern for any LLM service
async function secureInference(prompt: string, llmClient: any) {
  const engine = createAnonEngine();
  
  try {
    // 1. Anonymize
    const { anonPrompt, mapId, signature } = await engine.anonymize(prompt);
    
    // 2. Call your LLM service
    const response = await llmClient.generate(anonPrompt);
    
    // 3. Deanonymize
    return await engine.deanonymize(response, mapId, signature);
    
  } finally {
    engine.dispose();
  }
}
```

## 🧪 Testing

### Run Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm test -- --testPathPattern=anonEngine
npm test -- --testPathPattern=crypto
```

### Test Coverage

The library maintains >95% test coverage across:

- ✅ Core anonymization/deanonymization logic
- ✅ Token detection and classification
- ✅ Cryptographic operations
- ✅ Storage backend implementations
- ✅ Error handling and edge cases
- ✅ Integration workflows
- ✅ Security validation

### Example Test

```typescript
describe('Full Anonymization Workflow', () => {
  test('should anonymize and deanonymize customer data', async () => {
    const engine = createAnonEngine({ enableSignatures: true, signatureSecret: 'test' });
    
    const prompt = 'Customer: john@example.com, API: sk-1234567890abcdef';
    
    // Anonymize
    const result = await engine.anonymize(prompt);
    expect(result.anonPrompt).not.toContain('john@example.com');
    expect(result.anonPrompt).not.toContain('sk-1234567890abcdef');
    expect(result.anonPrompt).toContain('anon_');
    
    // Simulate LLM response
    const llmResponse = `Contact ${result.anonPrompt.split(' ')[1]} about ${result.anonPrompt.split(' ')[3]}`;
    
    // Deanonymize
    const final = await engine.deanonymize(llmResponse, result.mapId, result.signature);
    expect(final).toContain('john@example.com');
    expect(final).toContain('sk-1234567890abcdef');
    
    engine.dispose();
  });
});
```

## 📊 Performance

### Benchmarks

| Operation | Latency | Memory | Notes |
|-----------|---------|--------|-------|
| **Anonymization** | ~1-5ms | ~1KB | Per prompt, varies with content |
| **Deanonymization** | ~1-3ms | ~0.5KB | Per response |
| **Token Detection** | ~0.5-2ms | ~0.1KB | 15+ pattern types |
| **Storage (Memory)** | ~0.1ms | ~1KB | Per mapping |
| **Storage (Vault)** | ~50-100ms | ~0.1KB | Network dependent |
| **Signatures** | ~0.5-1ms | ~0.1KB | HMAC-SHA256 |

### Optimization Tips

1. **Reuse Engine Instances**
   ```typescript
   // ✅ Good - reuse engine
   const engine = createAnonEngine(config);
   const results = await Promise.all(
     prompts.map(p => engine.anonymize(p))
   );
   
   // ❌ Bad - create new engine each time
   const results = await Promise.all(
     prompts.map(p => createAnonEngine(config).anonymize(p))
   );
   ```

2. **Batch Operations**
   ```typescript
   // Process multiple prompts in parallel
   const engines = Array(10).fill(null).map(() => createAnonEngine(config));
   const results = await Promise.all(
     prompts.map((prompt, i) => engines[i % 10].anonymize(prompt))
   );
   ```

3. **Memory Management**
   ```typescript
   try {
     const engine = createAnonEngine(config);
     // ... use engine
   } finally {
     engine.dispose(); // Clean up resources
   }
   ```

## 🔒 Security Considerations

### Production Security Checklist

- [ ] **Environment Variables**: Store secrets in environment variables, not code
- [ ] **Vault Storage**: Use Vault for production instead of memory storage
- [ ] **Strong Signatures**: Generate secure HMAC secrets with `openssl rand -base64 32`
- [ ] **Disable Logging**: Set `enableLogging: false` in production
- [ ] **HTTPS Only**: Ensure all external LLM calls use HTTPS
- [ ] **Input Validation**: Validate all inputs before anonymization
- [ ] **Error Handling**: Implement proper error handling to prevent data leaks
- [ ] **Audit Logging**: Log anonymization operations for compliance (without sensitive data)

### Threat Model

| Threat | Mitigation |
|--------|------------|
| **Data Interception** | All sensitive data is anonymized before transmission |
| **Storage Compromise** | Use Vault with encryption at rest and access controls |
| **Mapping Tampering** | HMAC signatures detect unauthorized modifications |
| **Replay Attacks** | Unique mapping IDs prevent reuse of old mappings |
| **Side Channel** | Constant-time comparisons prevent timing attacks |
| **Memory Dumps** | Secure memory cleanup and limited TTL for mappings |

### Security Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Secure Environment                   │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐ │
│  │   Original  │    │ Anonymization│    │   Secure        │ │
│  │   Prompt    │───▶│   Engine     │───▶│   Storage       │ │
│  │             │    │              │    │   (Vault)       │ │
│  └─────────────┘    └──────────────┘    └─────────────────┘ │
│                             │                               │
└─────────────────────────────┼───────────────────────────────┘
                              │ Anonymized Data Only
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   External LLM Service                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  OpenAI / Anthropic / vLLM / Other                     │ │
│  │  ✅ Receives: anon_abc123, anon_def456                 │ │
│  │  ❌ Never sees: real API keys, emails, credentials     │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🐛 Troubleshooting

### Common Issues

#### 1. "Signature verification failed"

```typescript
// ❌ Problem: Different signature secrets
const engine1 = createAnonEngine({ signatureSecret: 'secret1' });
const engine2 = createAnonEngine({ signatureSecret: 'secret2' });

// ✅ Solution: Use the same secret for anonymization and deanonymization
const SECRET = process.env.ANON_SIGNATURE_SECRET;
const engine = createAnonEngine({ signatureSecret: SECRET });
```

#### 2. "Mapping not found"

```typescript
// ❌ Problem: Mapping expired or deleted
const result = await engine.anonymize(prompt);
await engine.deleteMapping(result.mapId); // Oops!
await engine.deanonymize(response, result.mapId); // Fails

// ✅ Solution: Don't delete mappings until after deanonymization
```

#### 3. "No sensitive tokens detected"

```typescript
// ❌ Problem: Custom patterns not detected
const prompt = 'My custom token: CUSTOM-123-ABC';

// ✅ Solution: Add custom patterns
const detector = new TokenDetector({
  customPatterns: [/CUSTOM-[0-9]+-[A-Z]+/g]
});
```

#### 4. "Vault connection failed"

```bash
# ✅ Solution: Check Vault configuration
export VAULT_ENDPOINT="http://localhost:8200"
export VAULT_TOKEN="your-vault-token"

# Test Vault connection
curl -H "X-Vault-Token: $VAULT_TOKEN" $VAULT_ENDPOINT/v1/sys/health
```

### Debug Mode

```typescript
const engine = createAnonEngine({
  enableLogging: true, // Enable detailed logging
  // ... other config
});

// Check engine health
const healthy = await engine.healthCheck();
console.log('Engine healthy:', healthy);

// Get engine information
const info = await engine.getInfo();
console.log('Engine info:', info);
```

### Health Checks

```typescript
import { healthCheck } from 'anon-infer-proxy';

const health = await healthCheck({
  strategy: 'hash_salt',
  storage: 'memory',
  enableSignatures: true,
  signatureSecret: 'test-secret'
});

console.log('Healthy:', health.healthy);
console.log('Components:', health.components);
console.log('Details:', health.details);
```

## 📚 API Reference

### Core Functions

#### `createAnonEngine(config?: AnonProxyConfig): AnonEngine`

Creates a new anonymization engine instance.

#### `anonymize(prompt: string, config?: AnonProxyConfig): Promise<AnonymizationResult>`

Convenience function for one-off anonymization.

#### `deanonymize(output: string, mapId: string, signature?: string, config?: AnonProxyConfig): Promise<string>`

Convenience function for one-off deanonymization.

### AnonEngine Class

#### `anonymize(prompt: string): Promise<AnonymizationResult>`

Anonymizes a prompt and returns the result with mapping information.

#### `deanonymize(output: string, mapId: string, signature?: string): Promise<string>`

Restores original tokens in the output using the provided mapping.

#### `deleteMapping(mapId: string): Promise<void>`

Deletes a mapping from storage (cleanup).

#### `healthCheck(): Promise<boolean>`

Checks if the engine and storage backend are healthy.

#### `getInfo(): Promise<EngineInfo>`

Returns information about the engine configuration and status.

#### `dispose(): void`

Cleans up resources and connections.

### Configuration Types

```typescript
interface AnonProxyConfig {
  strategy: AnonymizationStrategy;      // 'hash_salt' | 'embeddings'
  storage: StorageBackend;              // 'memory' | 'vault'
  enableSignatures: boolean;            // Enable HMAC signatures
  signatureSecret?: string;             // HMAC secret key
  enableLogging: boolean;               // Enable debug logging
  customSalt?: string;                  // Custom salt for hashing
}

interface AnonymizationResult {
  anonPrompt: string;                   // Anonymized prompt
  mapId: string;                        // Unique mapping identifier
  signature?: string;                   // HMAC signature for validation
}
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/Hubeet-AI/anon-infer-proxy.git
cd anon-infer-proxy

# Install dependencies
npm install

# Run tests
npm test

# Build the library
npm run build

# Run examples
cd examples && npm install && npm run openai
```

### Coding Standards

- **TypeScript**: Strict mode enabled, full type coverage
- **Testing**: >95% coverage required, comprehensive test cases
- **Security**: Security-first design, threat modeling
- **Documentation**: Comprehensive docs with examples
- **Performance**: Benchmarked performance for all operations

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **HashiCorp Vault** for secure storage backend
- **OpenAI** for LLM API standards
- **vLLM** for self-hosted model serving
- **Jest** for comprehensive testing framework
- **TypeScript** for type-safe development

## 📞 Support

- **Documentation**: [GitHub Wiki](https://github.com/Hubeet-AI/anon-infer-proxy/wiki)
- **Issues**: [GitHub Issues](https://github.com/Hubeet-AI/anon-infer-proxy/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Hubeet-AI/anon-infer-proxy/discussions)
- **Security**: Email security@hubeet.com for security issues

---

<div align="center">

**🔐 Keep your secrets secret, let AI help anyway**

Made with ❤️ by the [Hubeet](https://github.com/Hubeet-AI) team

</div>
# anon-infer-proxy
