const { createAnonEngine } = require('./dist/index.js');

console.log('🧪 Testing default configuration...');

async function test() {
	// Test with default config (no parameters)
	const engine = createAnonEngine();

	try {
		const prompt = 'API key: sk-1234567890abcdef, email: user@example.com';
		console.log('📥 Original:', prompt);

		const result = await engine.anonymize(prompt);
		console.log('🔒 Anonymized:', result.anonPrompt);
		console.log('🆔 Map ID:', result.mapId);
		console.log('🔏 Has signature:', !!result.signature);

		const restored = await engine.deanonymize(result.anonPrompt, result.mapId, result.signature);
		console.log('🔓 Restored:', restored);

		if (restored === prompt) {
			console.log('✅ Default config works perfectly!');
		} else {
			console.log('❌ Default config failed');
		}

	} catch (error) {
		console.error('❌ Test failed:', error.message);
	} finally {
		engine.dispose();
	}
}

test();
