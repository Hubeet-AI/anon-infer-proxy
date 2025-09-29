/**
 * vLLM Integration Example for anon-infer-proxy
 * 
 * This example demonstrates how to use anon-infer-proxy with vLLM
 * (Very Large Language Models) to anonymize sensitive data before inference.
 */

const { createAnonEngine, AnonymizationStrategy, StorageBackend } = require('../dist/index.js');
const http = require('http');
const https = require('https');

/**
 * Secure vLLM wrapper with anonymization
 */
class SecurevLLM {
	constructor(endpoint, options = {}) {
		try {
			this.endpoint = endpoint || process.env.VLLM_ENDPOINT || 'http://localhost:8000';

			// Parse endpoint to determine protocol
			const url = new URL(this.endpoint);
			this.httpClient = url.protocol === 'https:' ? https : http;

			// Initialize anonymization engine
			this.anonEngine = createAnonEngine({
				strategy: options.strategy || AnonymizationStrategy.HASH_SALT,
				storage: options.storage || StorageBackend.MEMORY,
				enableSignatures: options.enableSignatures !== false,
				signatureSecret: options.signatureSecret || process.env.ANON_SIGNATURE_SECRET || 'default-secret-change-in-production',
				enableLogging: options.enableLogging || false
			});

			this.options = {
				model: options.model || 'llama-2-7b-chat',
				maxTokens: options.maxTokens || 150,
				temperature: options.temperature || 0.7,
				topP: options.topP || 0.9,
				timeout: options.timeout || 30000,
				...options
			};

		} catch (error) {
			throw new Error(`Failed to initialize SecurevLLM: ${error.message}`);
		}
	}

	/**
	 * Make HTTP request to vLLM server
	 * @param {string} path - API path
	 * @param {string} method - HTTP method
	 * @param {Object} data - Request data
	 * @returns {Promise<Object>} Response data
	 */
	async makeRequest(path, method = 'POST', data = null) {
		return new Promise((resolve, reject) => {
			try {
				const url = new URL(path, this.endpoint);

				const requestOptions = {
					hostname: url.hostname,
					port: url.port || (url.protocol === 'https:' ? 443 : 80),
					path: url.pathname + url.search,
					method: method,
					headers: {
						'Content-Type': 'application/json',
						'Accept': 'application/json',
						'User-Agent': 'anon-infer-proxy/1.0.0'
					}
				};

				if (data) {
					const jsonData = JSON.stringify(data);
					requestOptions.headers['Content-Length'] = Buffer.byteLength(jsonData);
				}

				const req = this.httpClient.request(requestOptions, (res) => {
					let responseData = '';

					res.on('data', (chunk) => {
						responseData += chunk;
					});

					res.on('end', () => {
						try {
							if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
								const parsed = JSON.parse(responseData);
								resolve(parsed);
							} else {
								reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
							}
						} catch (parseError) {
							reject(new Error(`Failed to parse response: ${parseError.message}`));
						}
					});
				});

				req.on('error', (error) => {
					reject(new Error(`Request failed: ${error.message}`));
				});

				req.on('timeout', () => {
					req.destroy();
					reject(new Error('Request timeout'));
				});

				req.setTimeout(this.options.timeout);

				if (data) {
					req.write(JSON.stringify(data));
				}

				req.end();

			} catch (error) {
				reject(new Error(`Request setup failed: ${error.message}`));
			}
		});
	}

	/**
	 * Generate secure completion with anonymization
	 * @param {Object} params - Generation parameters
	 * @param {string} params.prompt - Input prompt
	 * @param {Object} params.options - Additional options
	 * @returns {Promise<Object>} Generation response with deanonymized content
	 */
	async generateSecure(params) {
		try {
			const { prompt, options = {} } = params;

			if (!prompt || typeof prompt !== 'string') {
				throw new Error('Prompt must be a non-empty string');
			}

			console.log('🔒 Starting secure vLLM generation...');

			// Step 1: Anonymize the prompt
			console.log('🔍 Analyzing prompt for sensitive content...');

			const anonResult = await this.anonEngine.anonymize(prompt);

			if (anonResult.anonPrompt !== prompt) {
				console.log('✅ Anonymized sensitive content in prompt');
			} else {
				console.log('ℹ️  No sensitive content detected in prompt');
			}

			// Step 2: Send anonymized prompt to vLLM
			console.log('🤖 Sending anonymized prompt to vLLM...');

			const requestData = {
				prompt: anonResult.anonPrompt,
				model: options.model || this.options.model,
				max_tokens: options.maxTokens || this.options.maxTokens,
				temperature: options.temperature !== undefined ? options.temperature : this.options.temperature,
				top_p: options.topP !== undefined ? options.topP : this.options.topP,
				stream: false,
				stop: options.stop || null,
				...options
			};

			const response = await this.makeRequest('/v1/completions', 'POST', requestData);

			// Step 3: Deanonymize the response
			console.log('🔓 Deanonymizing response...');

			let deanonymizedText = response.choices[0].text;

			try {
				deanonymizedText = await this.anonEngine.deanonymize(
					deanonymizedText,
					anonResult.mapId,
					anonResult.signature
				);
			} catch (deanonError) {
				console.warn(`⚠️  Warning: Could not deanonymize response: ${deanonError.message}`);
			}

			console.log('✅ Secure vLLM generation finished');

			// Return response with deanonymized content
			return {
				...response,
				choices: [{
					...response.choices[0],
					text: deanonymizedText
				}],
				// Include metadata about anonymization
				_anonymization: {
					hadSensitiveData: anonResult.anonPrompt !== prompt,
					mapId: anonResult.mapId,
					originalLength: prompt.length,
					anonymizedLength: anonResult.anonPrompt.length
				}
			};

		} catch (error) {
			console.error('❌ Error in secure vLLM generation:', error.message);
			throw error;
		}
	}

	/**
	 * Generate secure chat completion (if vLLM supports chat format)
	 * @param {Object} params - Chat parameters
	 * @param {Array} params.messages - Chat messages
	 * @param {Object} params.options - Additional options
	 * @returns {Promise<Object>} Chat response with deanonymized content
	 */
	async chatSecure(params) {
		try {
			const { messages, options = {} } = params;

			if (!messages || !Array.isArray(messages)) {
				throw new Error('Messages must be an array');
			}

			console.log('🔒 Starting secure vLLM chat...');

			// Step 1: Anonymize all messages and convert to prompt format
			const anonymizedMessages = [];
			const mappings = [];

			for (const message of messages) {
				if (message.content && typeof message.content === 'string') {
					console.log(`🔍 Analyzing message for sensitive content...`);

					const anonResult = await this.anonEngine.anonymize(message.content);

					anonymizedMessages.push({
						...message,
						content: anonResult.anonPrompt
					});

					mappings.push({
						mapId: anonResult.mapId,
						signature: anonResult.signature
					});

					if (anonResult.anonPrompt !== message.content) {
						console.log(`✅ Anonymized sensitive content in message`);
					}
				} else {
					anonymizedMessages.push(message);
					mappings.push(null);
				}
			}

			// Convert messages to prompt format for vLLM
			const prompt = this.messagesToPrompt(anonymizedMessages);

			// Step 2: Generate response
			console.log('🤖 Sending anonymized prompt to vLLM...');

			const requestData = {
				prompt: prompt,
				model: options.model || this.options.model,
				max_tokens: options.maxTokens || this.options.maxTokens,
				temperature: options.temperature !== undefined ? options.temperature : this.options.temperature,
				top_p: options.topP !== undefined ? options.topP : this.options.topP,
				stream: false,
				stop: options.stop || ['Human:', 'Assistant:', '\n\n'],
				...options
			};

			const response = await this.makeRequest('/v1/completions', 'POST', requestData);

			// Step 3: Deanonymize the response
			console.log('🔓 Deanonymizing response...');

			let deanonymizedContent = response.choices[0].text.trim();

			// Deanonymize using all mappings
			for (const mapping of mappings) {
				if (mapping) {
					try {
						deanonymizedContent = await this.anonEngine.deanonymize(
							deanonymizedContent,
							mapping.mapId,
							mapping.signature
						);
					} catch (error) {
						console.warn(`⚠️  Warning: Could not deanonymize part of response: ${error.message}`);
					}
				}
			}

			console.log('✅ Secure vLLM chat finished');

			// Format response similar to OpenAI chat format
			return {
				id: `chatcmpl-${Date.now()}`,
				object: 'chat.completion',
				created: Math.floor(Date.now() / 1000),
				model: requestData.model,
				choices: [{
					index: 0,
					message: {
						role: 'assistant',
						content: deanonymizedContent
					},
					finish_reason: 'stop'
				}],
				usage: response.usage || {
					prompt_tokens: -1,
					completion_tokens: -1,
					total_tokens: -1
				},
				_anonymization: {
					hadSensitiveData: mappings.some(m => m !== null),
					mappingsUsed: mappings.filter(m => m !== null).length
				}
			};

		} catch (error) {
			console.error('❌ Error in secure vLLM chat:', error.message);
			throw error;
		}
	}

	/**
	 * Convert messages array to prompt string
	 * @param {Array} messages - Array of message objects
	 * @returns {string} Formatted prompt
	 */
	messagesToPrompt(messages) {
		try {
			let prompt = '';

			for (const message of messages) {
				const role = message.role === 'user' ? 'Human' :
					message.role === 'assistant' ? 'Assistant' :
						message.role === 'system' ? 'System' : 'Unknown';

				prompt += `${role}: ${message.content}\n\n`;
			}

			prompt += 'Assistant: ';
			return prompt;

		} catch (error) {
			throw new Error(`Failed to convert messages to prompt: ${error.message}`);
		}
	}

	/**
	 * Check if vLLM server is available
	 * @returns {Promise<boolean>} True if server is available
	 */
	async healthCheck() {
		try {
			const response = await this.makeRequest('/health', 'GET');
			return response.status === 'ok' || response.status === 'healthy';
		} catch (error) {
			console.warn(`vLLM health check failed: ${error.message}`);
			return false;
		}
	}

	/**
	 * Get available models from vLLM server
	 * @returns {Promise<Array>} List of available models
	 */
	async getModels() {
		try {
			const response = await this.makeRequest('/v1/models', 'GET');
			return response.data || [];
		} catch (error) {
			console.warn(`Failed to get models: ${error.message}`);
			return [];
		}
	}

	/**
	 * Cleanup resources
	 */
	dispose() {
		try {
			if (this.anonEngine) {
				this.anonEngine.dispose();
			}
		} catch (error) {
			console.warn('Warning during cleanup:', error.message);
		}
	}
}

/**
 * Example usage demonstrating various scenarios
 */
async function runExamples() {
	console.log('🚀 Starting vLLM Integration Examples\n');

	const secureLLM = new SecurevLLM(process.env.VLLM_ENDPOINT, {
		enableLogging: true,
		model: 'llama-2-7b-chat'
	});

	try {
		// Check if vLLM server is available
		console.log('🏥 Checking vLLM server health...');
		const isHealthy = await secureLLM.healthCheck();

		if (!isHealthy) {
			console.log('⚠️  vLLM server not available. Using mock examples.');
			console.log('💡 To run with real vLLM, start a vLLM server and set VLLM_ENDPOINT');
			return;
		}

		console.log('✅ vLLM server is healthy\n');

		// Get available models
		const models = await secureLLM.getModels();
		console.log(`📋 Available models: ${models.map(m => m.id || m).join(', ')}\n`);

		// Example 1: Code review with API keys
		console.log('💻 Example 1: Code Review with Secrets');
		console.log('====================================');

		const codeCompletion = await secureLLM.generateSecure({
			prompt: `
        Please review this code for security issues:
        
        const config = {
          apiKey: 'sk-1234567890abcdef',
          databaseUrl: 'postgresql://user:password@db.example.com:5432/mydb',
          adminEmail: 'admin@company.com',
          webhookSecret: 'whsec_abc123def456'
        };
        
        What security problems do you see?
      `,
			options: {
				maxTokens: 200,
				temperature: 0.7
			}
		});

		console.log('📋 Response:');
		console.log(codeCompletion.choices[0].text);
		console.log(`\n🔐 Anonymization used: ${codeCompletion._anonymization.hadSensitiveData ? 'Yes' : 'No'}`);
		console.log('\n' + '='.repeat(50) + '\n');

		// Example 2: Chat format with customer data
		console.log('💬 Example 2: Customer Support Chat');
		console.log('=================================');

		const chatCompletion = await secureLLM.chatSecure({
			messages: [
				{
					role: 'system',
					content: 'You are a helpful customer support agent. Be professional and helpful.'
				},
				{
					role: 'user',
					content: `
            Hello, I'm having issues with my account. Here are my details:
            - Email: customer@example.com
            - Phone: +1-555-987-6543
            - Account ID: acc_789xyz123
            - API Key: sk-abcdef1234567890
            
            My API calls keep failing with 401 errors. Can you help?
          `
				}
			],
			options: {
				maxTokens: 150,
				temperature: 0.8
			}
		});

		console.log('📋 Response:');
		console.log(chatCompletion.choices[0].message.content);
		console.log(`\n🔐 Anonymization used: ${chatCompletion._anonymization.hadSensitiveData ? 'Yes' : 'No'}`);
		console.log('\n' + '='.repeat(50) + '\n');

		// Example 3: Infrastructure query
		console.log('☁️  Example 3: Infrastructure Planning');
		console.log('====================================');

		const infraCompletion = await secureLLM.generateSecure({
			prompt: `
        Help me plan a secure deployment for:
        - Database: mysql://root:secretpassword@10.0.1.100:3306/prod
        - Redis: redis://admin:redispass@10.0.1.101:6379
        - Admin access: ssh admin@10.0.1.102 with key ~/.ssh/prod_key
        
        What security measures should I implement?
      `,
			options: {
				maxTokens: 180,
				temperature: 0.6
			}
		});

		console.log('📋 Response:');
		console.log(infraCompletion.choices[0].text);
		console.log(`\n🔐 Anonymization used: ${infraCompletion._anonymization.hadSensitiveData ? 'Yes' : 'No'}`);

		console.log('\n✅ All examples completed successfully!');

	} catch (error) {
		console.error('❌ Example failed:', error.message);

		if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
			console.log('\n💡 Tip: Make sure vLLM server is running and set the endpoint:');
			console.log('   export VLLM_ENDPOINT="http://your-vllm-server:8000"');
		}
	} finally {
		secureLLM.dispose();
	}
}

/**
 * Health check function
 */
async function healthCheck() {
	try {
		console.log('🏥 Running vLLM integration health check...');

		const secureLLM = new SecurevLLM(process.env.VLLM_ENDPOINT, {
			enableLogging: false
		});

		try {
			// Test anonymization engine
			const testPrompt = 'Test with API key sk-test123456';
			const anonResult = await secureLLM.anonEngine.anonymize(testPrompt);

			if (!anonResult.anonPrompt.includes('anon_')) {
				throw new Error('Anonymization not working');
			}

			console.log('✅ Anonymization engine: OK');

			// Test vLLM connection
			const isHealthy = await secureLLM.healthCheck();
			if (isHealthy) {
				console.log('✅ vLLM server connection: OK');
			} else {
				console.log('⚠️  vLLM server connection: Failed');
			}

			console.log('✅ Health check completed');
			return isHealthy;

		} finally {
			secureLLM.dispose();
		}

	} catch (error) {
		console.error('❌ Health check failed:', error.message);
		return false;
	}
}

// Export for use as module
module.exports = {
	SecurevLLM,
	runExamples,
	healthCheck
};

// Run examples if this file is executed directly
if (require.main === module) {
	const command = process.argv[2];

	if (command === 'health') {
		healthCheck().then(success => {
			process.exit(success ? 0 : 1);
		});
	} else {
		runExamples().catch(error => {
			console.error('Fatal error:', error.message);
			process.exit(1);
		});
	}
}
