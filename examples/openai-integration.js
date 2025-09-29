/**
 * OpenAI Integration Example for anon-infer-proxy
 * 
 * This example demonstrates how to use anon-infer-proxy with OpenAI's API
 * to anonymize sensitive data before sending prompts to OpenAI.
 */

const { createAnonEngine, AnonymizationStrategy, StorageBackend } = require('../dist/index.js');

// OpenAI API client (install with: npm install openai)
let OpenAI;
try {
	OpenAI = require('openai');
} catch (error) {
	console.error('OpenAI package not found. Install with: npm install openai');
	process.exit(1);
}

/**
 * Secure OpenAI wrapper with anonymization
 */
class SecureOpenAI {
	constructor(apiKey, options = {}) {
		try {
			// Initialize OpenAI client
			this.openai = new OpenAI({
				apiKey: apiKey || process.env.OPENAI_API_KEY
			});

			// Initialize anonymization engine
			this.anonEngine = createAnonEngine({
				strategy: options.strategy || AnonymizationStrategy.HASH_SALT,
				storage: options.storage || StorageBackend.MEMORY,
				enableSignatures: options.enableSignatures !== false,
				signatureSecret: options.signatureSecret || process.env.ANON_SIGNATURE_SECRET || 'default-secret-change-in-production',
				enableLogging: options.enableLogging || false
			});

			this.options = {
				model: options.model || 'gpt-3.5-turbo',
				maxTokens: options.maxTokens || 150,
				temperature: options.temperature || 0.7,
				...options
			};

		} catch (error) {
			throw new Error(`Failed to initialize SecureOpenAI: ${error.message}`);
		}
	}

	/**
	 * Create a secure chat completion with anonymization
	 * @param {Object} params - Parameters for chat completion
	 * @param {Array} params.messages - Chat messages
	 * @param {Object} params.options - Additional options
	 * @returns {Promise<Object>} Chat completion response with deanonymized content
	 */
	async createSecureChatCompletion(params) {
		try {
			const { messages, options = {} } = params;

			if (!messages || !Array.isArray(messages)) {
				throw new Error('Messages must be an array');
			}

			console.log('🔒 Starting secure chat completion...');

			// Step 1: Anonymize all messages
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
					} else {
						console.log(`ℹ️  No sensitive content detected in message`);
					}
				} else {
					anonymizedMessages.push(message);
					mappings.push(null);
				}
			}

			// Step 2: Send anonymized prompt to OpenAI
			console.log('🤖 Sending anonymized prompt to OpenAI...');

			const completion = await this.openai.chat.completions.create({
				model: options.model || this.options.model,
				messages: anonymizedMessages,
				max_tokens: options.maxTokens || this.options.maxTokens,
				temperature: options.temperature !== undefined ? options.temperature : this.options.temperature,
				...options
			});

			// Step 3: Deanonymize the response
			console.log('🔓 Deanonymizing response...');

			let deanonymizedContent = completion.choices[0].message.content;

			// Deanonymize using all mappings (in case response references multiple anonymized tokens)
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

			console.log('✅ Secure chat completion finished');

			// Return the response with deanonymized content
			return {
				...completion,
				choices: [{
					...completion.choices[0],
					message: {
						...completion.choices[0].message,
						content: deanonymizedContent
					}
				}],
				// Include metadata about anonymization
				_anonymization: {
					hadSensitiveData: mappings.some(m => m !== null),
					mappingsUsed: mappings.filter(m => m !== null).length
				}
			};

		} catch (error) {
			console.error('❌ Error in secure chat completion:', error.message);
			throw error;
		}
	}

	/**
	 * Create a secure text completion (legacy models)
	 * @param {Object} params - Parameters for completion
	 * @returns {Promise<Object>} Completion response with deanonymized content
	 */
	async createSecureCompletion(params) {
		try {
			const { prompt, ...options } = params;

			if (!prompt || typeof prompt !== 'string') {
				throw new Error('Prompt must be a non-empty string');
			}

			console.log('🔒 Starting secure completion...');

			// Anonymize prompt
			const anonResult = await this.anonEngine.anonymize(prompt);

			if (anonResult.anonPrompt !== prompt) {
				console.log('✅ Anonymized sensitive content in prompt');
			}

			// Send to OpenAI
			console.log('🤖 Sending anonymized prompt to OpenAI...');

			const completion = await this.openai.completions.create({
				model: options.model || 'text-davinci-003',
				prompt: anonResult.anonPrompt,
				max_tokens: options.maxTokens || this.options.maxTokens,
				temperature: options.temperature !== undefined ? options.temperature : this.options.temperature,
				...options
			});

			// Deanonymize response
			console.log('🔓 Deanonymizing response...');

			const deanonymizedText = await this.anonEngine.deanonymize(
				completion.choices[0].text,
				anonResult.mapId,
				anonResult.signature
			);

			console.log('✅ Secure completion finished');

			return {
				...completion,
				choices: [{
					...completion.choices[0],
					text: deanonymizedText
				}],
				_anonymization: {
					hadSensitiveData: anonResult.anonPrompt !== prompt,
					mapId: anonResult.mapId
				}
			};

		} catch (error) {
			console.error('❌ Error in secure completion:', error.message);
			throw error;
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
	console.log('🚀 Starting OpenAI Integration Examples\n');

	const secureAI = new SecureOpenAI(process.env.OPENAI_API_KEY, {
		enableLogging: true,
		model: 'gpt-3.5-turbo'
	});

	try {
		// Example 1: Customer support with PII
		console.log('📞 Example 1: Customer Support Scenario');
		console.log('=====================================');

		const customerSupportCompletion = await secureAI.createSecureChatCompletion({
			messages: [
				{
					role: 'system',
					content: 'You are a helpful customer support assistant. Help resolve customer issues professionally.'
				},
				{
					role: 'user',
					content: `
            I need help with my account. Here are my details:
            - Email: john.doe@company.com
            - Phone: +1-555-123-4567
            - API Key: sk-1234567890abcdef
            - Customer ID: cust_abc123def456
            
            I'm having trouble accessing my dashboard and my API calls are failing.
          `
				}
			]
		});

		console.log('📋 Response:');
		console.log(customerSupportCompletion.choices[0].message.content);
		console.log(`\n🔐 Anonymization used: ${customerSupportCompletion._anonymization.hadSensitiveData ? 'Yes' : 'No'}`);
		console.log('\n' + '='.repeat(50) + '\n');

		// Example 2: AWS Infrastructure query
		console.log('☁️  Example 2: AWS Infrastructure Planning');
		console.log('========================================');

		const awsCompletion = await secureAI.createSecureChatCompletion({
			messages: [
				{
					role: 'user',
					content: `
            I need to set up AWS infrastructure with these credentials:
            - AWS Access Key: AKIAIOSFODNN7EXAMPLE
            - Secret Key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
            - VPC ID: vpc-12345678
            - Database endpoint: mydb.cluster-abc123.us-east-1.rds.amazonaws.com
            
            How should I configure the security groups and networking?
          `
				}
			]
		});

		console.log('📋 Response:');
		console.log(awsCompletion.choices[0].message.content);
		console.log(`\n🔐 Anonymization used: ${awsCompletion._anonymization.hadSensitiveData ? 'Yes' : 'No'}`);
		console.log('\n' + '='.repeat(50) + '\n');

		// Example 3: Normal query without sensitive data
		console.log('💬 Example 3: Normal Query (No Sensitive Data)');
		console.log('=============================================');

		const normalCompletion = await secureAI.createSecureChatCompletion({
			messages: [
				{
					role: 'user',
					content: 'What are the best practices for API design?'
				}
			]
		});

		console.log('📋 Response:');
		console.log(normalCompletion.choices[0].message.content);
		console.log(`\n🔐 Anonymization used: ${normalCompletion._anonymization.hadSensitiveData ? 'Yes' : 'No'}`);
		console.log('\n' + '='.repeat(50) + '\n');

		console.log('✅ All examples completed successfully!');

	} catch (error) {
		console.error('❌ Example failed:', error.message);

		if (error.message.includes('API key')) {
			console.log('\n💡 Tip: Set your OpenAI API key with:');
			console.log('   export OPENAI_API_KEY="your-api-key-here"');
		}
	} finally {
		secureAI.dispose();
	}
}

/**
 * Health check function
 */
async function healthCheck() {
	try {
		console.log('🏥 Running health check...');

		const secureAI = new SecureOpenAI(process.env.OPENAI_API_KEY, {
			enableLogging: false
		});

		try {
			// Test anonymization engine
			const testPrompt = 'Test with API key sk-test123456';
			const anonResult = await secureAI.anonEngine.anonymize(testPrompt);

			if (!anonResult.anonPrompt.includes('anon_')) {
				throw new Error('Anonymization not working');
			}

			console.log('✅ Anonymization engine: OK');

			// Test OpenAI connection (if API key provided)
			if (process.env.OPENAI_API_KEY) {
				await secureAI.openai.models.list();
				console.log('✅ OpenAI connection: OK');
			} else {
				console.log('⚠️  OpenAI connection: Not tested (no API key)');
			}

			console.log('✅ Health check passed');
			return true;

		} finally {
			secureAI.dispose();
		}

	} catch (error) {
		console.error('❌ Health check failed:', error.message);
		return false;
	}
}

// Export for use as module
module.exports = {
	SecureOpenAI,
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
