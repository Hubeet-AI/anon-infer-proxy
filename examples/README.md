# anon-infer-proxy Examples

This directory contains practical examples and integrations for using `anon-infer-proxy` with popular LLM services and frameworks.

## 📁 Files Overview

- **`openai-integration.js`** - Complete OpenAI API integration with anonymization
- **`vllm-integration.js`** - vLLM (Very Large Language Models) integration
- **`python-wrapper.py`** - Python wrapper for the Node.js library
- **`package.json`** - Dependencies for Node.js examples

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install example dependencies
cd examples
npm install

# For Python wrapper, ensure you have Python 3.6+
python3 --version
```

### 2. OpenAI Integration

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-openai-api-key"

# Run OpenAI examples
npm run openai

# Or run health check only
npm run openai:health
```

#### Example Output:
```
🚀 Starting OpenAI Integration Examples

📞 Example 1: Customer Support Scenario
=====================================
🔒 Starting secure chat completion...
🔍 Analyzing message for sensitive content...
✅ Anonymized sensitive content in message
🤖 Sending anonymized prompt to OpenAI...
🔓 Deanonymizing response...
✅ Secure chat completion finished

📋 Response:
I understand you're having trouble with your account. Let me help you with accessing your dashboard and resolving the API issues...

🔐 Anonymization used: Yes
```

### 3. vLLM Integration

```bash
# Set your vLLM endpoint (if running locally)
export VLLM_ENDPOINT="http://localhost:8000"

# Run vLLM examples
npm run vllm

# Or run health check only
npm run vllm:health
```

### 4. Python Wrapper

```bash
# Run Python examples
npm run python

# Or directly with Python
python3 python-wrapper.py
```

## 📝 Detailed Examples

### OpenAI Integration Features

The OpenAI integration (`SecureOpenAI` class) provides:

- **Automatic Anonymization**: Detects and anonymizes sensitive data before sending to OpenAI
- **Signature Validation**: Ensures data integrity with cryptographic signatures
- **Multiple Message Support**: Handles chat completions with multiple messages
- **Transparent Deanonymization**: Restores original data in responses
- **Error Handling**: Robust error handling and logging

#### Usage:

```javascript
const { SecureOpenAI } = require('./openai-integration.js');

const secureAI = new SecureOpenAI(process.env.OPENAI_API_KEY, {
  enableSignatures: true,
  signatureSecret: 'your-secret-key',
  enableLogging: true
});

const response = await secureAI.createSecureChatCompletion({
  messages: [
    {
      role: 'user',
      content: 'Help me with API key sk-1234567890abcdef'
    }
  ]
});

console.log(response.choices[0].message.content);
secureAI.dispose();
```

### vLLM Integration Features

The vLLM integration (`SecurevLLM` class) provides:

- **HTTP Client**: Direct communication with vLLM servers
- **Chat Format Support**: Converts chat messages to vLLM prompt format
- **Health Monitoring**: Built-in health checks for vLLM servers
- **Model Discovery**: Automatic detection of available models
- **Flexible Configuration**: Supports various vLLM configurations

#### Usage:

```javascript
const { SecurevLLM } = require('./vllm-integration.js');

const secureLLM = new SecurevLLM('http://localhost:8000', {
  model: 'llama-2-7b-chat',
  enableSignatures: true
});

const response = await secureLLM.generateSecure({
  prompt: 'Code review for API key sk-1234567890abcdef',
  options: { maxTokens: 150 }
});

console.log(response.choices[0].text);
secureLLM.dispose();
```

### Python Wrapper Features

The Python wrapper (`AnonInferProxy` class) provides:

- **Native Python Interface**: Use anon-infer-proxy from Python applications
- **Subprocess Communication**: Bridges Python and Node.js seamlessly
- **Type Hints**: Full type annotation support
- **Error Handling**: Python-native exception handling
- **Configuration Validation**: Validates settings before execution

#### Usage:

```python
from python_wrapper import AnonInferProxy

proxy = AnonInferProxy(
    strategy="hash_salt",
    enable_signatures=True,
    signature_secret="your-secret"
)

# Anonymize
result = proxy.anonymize("API key: sk-1234567890abcdef")
print(f"Anonymized: {result.anon_prompt}")

# Deanonymize
output = proxy.deanonymize("Response text", result.map_id, result.signature)
print(f"Restored: {output}")
```

## 🔧 Configuration Options

### Common Configuration

All examples support these configuration options:

```javascript
{
  strategy: "hash_salt" | "embeddings",      // Anonymization strategy
  storage: "memory" | "vault",               // Storage backend
  enableSignatures: boolean,                 // Cryptographic validation
  signatureSecret: string,                   // HMAC secret key
  enableLogging: boolean,                    // Enable debug logging
  customSalt: string                         // Custom salt for hashing
}
```

### Environment Variables

- **`OPENAI_API_KEY`** - Your OpenAI API key
- **`VLLM_ENDPOINT`** - vLLM server endpoint (default: http://localhost:8000)
- **`ANON_SIGNATURE_SECRET`** - Secret for HMAC signatures
- **`VAULT_TOKEN`** - Vault authentication token (for Vault storage)
- **`VAULT_ENDPOINT`** - Vault server endpoint

## 🛡️ Security Considerations

### Production Guidelines

1. **API Keys**: Never hardcode API keys. Use environment variables or secure vaults.

2. **Signature Secrets**: Use strong, randomly generated secrets for HMAC signatures:
   ```bash
   export ANON_SIGNATURE_SECRET=$(openssl rand -base64 32)
   ```

3. **Vault Storage**: For production, use Vault storage instead of memory:
   ```javascript
   {
     storage: "vault",
     // Vault configuration via environment variables
   }
   ```

4. **Network Security**: Ensure secure communication with LLM services:
   - Use HTTPS endpoints
   - Validate SSL certificates
   - Implement proper timeout handling

5. **Logging**: Disable logging in production to prevent accidental data leakage:
   ```javascript
   { enableLogging: false }
   ```

### Data Flow Security

```
Original Prompt → Anonymization → External LLM → Deanonymization → Final Response
     🔒              🔐              🤖              🔓              ✅
```

- **Original data** never leaves your environment
- **Anonymized data** is safe to send to external services
- **Mapping data** is stored securely with optional encryption
- **Signatures** ensure data integrity throughout the process

## 🧪 Testing

### Run All Health Checks

```bash
npm run test
```

### Individual Testing

```bash
# Test OpenAI integration
node openai-integration.js health

# Test vLLM integration  
node vllm-integration.js health

# Test Python wrapper
python3 -c "from python_wrapper import AnonInferProxy; print('✅ OK' if AnonInferProxy().health_check() else '❌ Failed')"
```

## 📊 Performance Considerations

### Latency Impact

- **Anonymization**: ~1-5ms for typical prompts
- **Deanonymization**: ~1-3ms for typical responses
- **Total Overhead**: Usually <10ms additional latency

### Memory Usage

- **Memory Storage**: ~1KB per mapping (varies with prompt size)
- **Vault Storage**: Minimal local memory usage
- **Process Overhead**: ~10-20MB for Node.js runtime

### Optimization Tips

1. **Reuse Engine Instances**: Create one engine instance and reuse it
2. **Batch Operations**: Process multiple prompts in parallel when possible
3. **Cleanup Mappings**: Delete mappings when no longer needed
4. **Monitor Performance**: Use built-in logging and metrics

## 🔗 Integration Patterns

### Middleware Pattern

```javascript
// Express.js middleware example
const anonMiddleware = (req, res, next) => {
  const engine = createAnonEngine(config);
  req.anonEngine = engine;
  res.on('finish', () => engine.dispose());
  next();
};
```

### Decorator Pattern

```python
def anonymize_llm_call(func):
    def wrapper(*args, **kwargs):
        proxy = AnonInferProxy()
        # Anonymize inputs, call function, deanonymize outputs
        # ... implementation
    return wrapper

@anonymize_llm_call
def call_openai(prompt):
    # Your OpenAI call here
    pass
```

### Async/Await Pattern

```javascript
async function secureInference(prompt) {
  const engine = createAnonEngine();
  try {
    const anon = await engine.anonymize(prompt);
    const response = await callExternalLLM(anon.anonPrompt);
    return await engine.deanonymize(response, anon.mapId, anon.signature);
  } finally {
    engine.dispose();
  }
}
```

## 📞 Support

For questions about the examples:

1. Check the main [README](../README.md) for general documentation
2. Review the inline code comments for detailed explanations
3. Run health checks to diagnose issues
4. Check environment variable configuration

## 📄 License

These examples are released under the MIT License, same as the main library.
