#!/usr/bin/env python3
"""
Python wrapper for anon-infer-proxy

This module provides a Python interface to the anon-infer-proxy library
through subprocess calls to the Node.js implementation.
"""

import json
import subprocess
import tempfile
import os
from typing import Dict, Any, Optional, Union, List
from dataclasses import dataclass
from pathlib import Path


@dataclass
class AnonymizationResult:
    """Result of anonymization operation"""
    anon_prompt: str
    map_id: str
    signature: Optional[str] = None


class AnonInferProxyError(Exception):
    """Base exception for anon-infer-proxy errors"""
    pass


class AnonInferProxy:
    """
    Python wrapper for anon-infer-proxy library
    
    This class provides a Python interface to anonymize and deanonymize
    prompts using the Node.js anon-infer-proxy library.
    """
    
    def __init__(self, 
                 strategy: str = "hash_salt",
                 storage: str = "memory", 
                 enable_signatures: bool = True,
                 signature_secret: Optional[str] = None,
                 enable_logging: bool = False,
                 node_path: str = "node",
                 library_path: Optional[str] = None):
        """
        Initialize the anon-infer-proxy wrapper
        
        Args:
            strategy: Anonymization strategy ("hash_salt" or "embeddings")
            storage: Storage backend ("memory" or "vault")
            enable_signatures: Whether to enable cryptographic signatures
            signature_secret: Secret for HMAC signatures (required if enable_signatures=True)
            enable_logging: Whether to enable logging
            node_path: Path to Node.js executable
            library_path: Path to anon-infer-proxy library (auto-detected if None)
        """
        self.config = {
            "strategy": strategy,
            "storage": storage,
            "enableSignatures": enable_signatures,
            "signatureSecret": signature_secret,
            "enableLogging": enable_logging
        }
        
        self.node_path = node_path
        self.library_path = library_path or self._find_library_path()
        
        # Validate configuration
        self._validate_config()
    
    def _find_library_path(self) -> str:
        """Auto-detect the library path"""
        try:
            # Try to find the library relative to this file
            current_dir = Path(__file__).parent
            
            # Look for dist/index.js
            possible_paths = [
                current_dir.parent / "dist" / "index.js",
                current_dir / ".." / "dist" / "index.js",
                current_dir / "dist" / "index.js"
            ]
            
            for path in possible_paths:
                if path.exists():
                    return str(path.resolve())
            
            raise FileNotFoundError("Could not find anon-infer-proxy library")
            
        except Exception as e:
            raise AnonInferProxyError(f"Failed to find library path: {e}")
    
    def _validate_config(self):
        """Validate the configuration"""
        if self.config["enableSignatures"] and not self.config["signatureSecret"]:
            raise AnonInferProxyError("signatureSecret is required when enableSignatures is True")
        
        if self.config["strategy"] not in ["hash_salt", "embeddings"]:
            raise AnonInferProxyError(f"Invalid strategy: {self.config['strategy']}")
        
        if self.config["storage"] not in ["memory", "vault"]:
            raise AnonInferProxyError(f"Invalid storage: {self.config['storage']}")
    
    def _run_node_script(self, script_content: str, input_data: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Run a Node.js script with the anon-infer-proxy library
        
        Args:
            script_content: JavaScript code to execute
            input_data: Optional input data to pass to the script
            
        Returns:
            Parsed JSON result from the script
        """
        try:
            # Create temporary script file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
                f.write(script_content)
                script_path = f.name
            
            try:
                # Prepare command
                cmd = [self.node_path, script_path]
                
                # Prepare input
                script_input = None
                if input_data:
                    script_input = json.dumps(input_data).encode('utf-8')
                
                # Run the script
                process = subprocess.Popen(
                    cmd,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    cwd=os.path.dirname(self.library_path)
                )
                
                stdout, stderr = process.communicate(input=script_input, timeout=30)
                
                if process.returncode != 0:
                    raise AnonInferProxyError(f"Node.js script failed: {stderr.decode('utf-8')}")
                
                # Parse result
                try:
                    return json.loads(stdout.decode('utf-8'))
                except json.JSONDecodeError as e:
                    raise AnonInferProxyError(f"Failed to parse script output: {e}")
                
            finally:
                # Clean up temporary file
                try:
                    os.unlink(script_path)
                except OSError:
                    pass
                    
        except subprocess.TimeoutExpired:
            raise AnonInferProxyError("Script execution timeout")
        except Exception as e:
            raise AnonInferProxyError(f"Script execution failed: {e}")
    
    def anonymize(self, prompt: str) -> AnonymizationResult:
        """
        Anonymize a prompt
        
        Args:
            prompt: Input prompt containing sensitive data
            
        Returns:
            AnonymizationResult with anonymized prompt and mapping info
        """
        if not prompt or not isinstance(prompt, str):
            raise AnonInferProxyError("Prompt must be a non-empty string")
        
        script = f"""
        const {{ createAnonEngine }} = require('{self.library_path}');
        
        async function main() {{
            const engine = createAnonEngine({json.dumps(self.config)});
            
            try {{
                const input = JSON.parse(process.argv[2] || '{{}}');
                const result = await engine.anonymize(input.prompt);
                
                console.log(JSON.stringify({{
                    success: true,
                    result: result
                }}));
                
            }} catch (error) {{
                console.log(JSON.stringify({{
                    success: false,
                    error: error.message
                }}));
            }} finally {{
                engine.dispose();
            }}
        }}
        
        main().catch(error => {{
            console.log(JSON.stringify({{
                success: false,
                error: error.message
            }}));
        }});
        """
        
        input_data = {"prompt": prompt}
        result = self._run_node_script(script, input_data)
        
        if not result.get("success"):
            raise AnonInferProxyError(f"Anonymization failed: {result.get('error', 'Unknown error')}")
        
        result_data = result["result"]
        return AnonymizationResult(
            anon_prompt=result_data["anonPrompt"],
            map_id=result_data["mapId"],
            signature=result_data.get("signature")
        )
    
    def deanonymize(self, output: str, map_id: str, signature: Optional[str] = None) -> str:
        """
        Deanonymize output from external service
        
        Args:
            output: Output containing proxy tokens
            map_id: Mapping ID from anonymization
            signature: Optional signature for validation
            
        Returns:
            Deanonymized output with original tokens restored
        """
        if not output or not isinstance(output, str):
            raise AnonInferProxyError("Output must be a non-empty string")
        
        if not map_id or not isinstance(map_id, str):
            raise AnonInferProxyError("Map ID must be a non-empty string")
        
        script = f"""
        const {{ createAnonEngine }} = require('{self.library_path}');
        
        async function main() {{
            const engine = createAnonEngine({json.dumps(self.config)});
            
            try {{
                const input = JSON.parse(process.argv[2] || '{{}}');
                const result = await engine.deanonymize(
                    input.output, 
                    input.mapId, 
                    input.signature
                );
                
                console.log(JSON.stringify({{
                    success: true,
                    result: result
                }}));
                
            }} catch (error) {{
                console.log(JSON.stringify({{
                    success: false,
                    error: error.message
                }}));
            }} finally {{
                engine.dispose();
            }}
        }}
        
        main().catch(error => {{
            console.log(JSON.stringify({{
                success: false,
                error: error.message
            }}));
        }});
        """
        
        input_data = {
            "output": output,
            "mapId": map_id,
            "signature": signature
        }
        
        result = self._run_node_script(script, input_data)
        
        if not result.get("success"):
            raise AnonInferProxyError(f"Deanonymization failed: {result.get('error', 'Unknown error')}")
        
        return result["result"]
    
    def health_check(self) -> bool:
        """
        Check if the library is working correctly
        
        Returns:
            True if healthy, False otherwise
        """
        try:
            script = f"""
            const {{ healthCheck }} = require('{self.library_path}');
            
            async function main() {{
                try {{
                    const result = await healthCheck({json.dumps(self.config)});
                    console.log(JSON.stringify({{
                        success: true,
                        healthy: result.healthy
                    }}));
                }} catch (error) {{
                    console.log(JSON.stringify({{
                        success: false,
                        error: error.message
                    }}));
                }}
            }}
            
            main();
            """
            
            result = self._run_node_script(script)
            return result.get("success", False) and result.get("healthy", False)
            
        except Exception:
            return False


def example_usage():
    """Example usage of the Python wrapper"""
    
    print("🐍 Python wrapper for anon-infer-proxy")
    print("=" * 40)
    
    try:
        # Initialize the proxy
        proxy = AnonInferProxy(
            strategy="hash_salt",
            storage="memory",
            enable_signatures=True,
            signature_secret="python-example-secret",
            enable_logging=True
        )
        
        # Test health check
        print("🏥 Health check:", "✅ OK" if proxy.health_check() else "❌ Failed")
        
        # Example 1: Basic anonymization
        print("\n📝 Example 1: Basic Anonymization")
        print("-" * 30)
        
        original_prompt = """
        Please help me configure this system:
        - API Key: sk-1234567890abcdef
        - Admin email: admin@company.com
        - Database URL: postgresql://user:pass@db.example.com/prod
        """
        
        print(f"Original prompt: {original_prompt.strip()}")
        
        # Anonymize
        anon_result = proxy.anonymize(original_prompt)
        print(f"\nAnonymized: {anon_result.anon_prompt.strip()}")
        print(f"Map ID: {anon_result.map_id}")
        
        # Simulate external service response
        external_response = f"""
        I'll help you configure the system:
        1. Set up API authentication with {anon_result.anon_prompt.split()[15]}
        2. Send notifications to {anon_result.anon_prompt.split()[18]}
        3. Configure database connection to {anon_result.anon_prompt.split()[21]}
        """
        
        print(f"\nExternal service response: {external_response.strip()}")
        
        # Deanonymize
        final_response = proxy.deanonymize(
            external_response, 
            anon_result.map_id, 
            anon_result.signature
        )
        
        print(f"\nDeanonymized response: {final_response.strip()}")
        
        # Example 2: Multiple anonymizations
        print("\n📝 Example 2: Multiple Prompts")
        print("-" * 30)
        
        prompts = [
            "User ID: user_123456 needs access",
            "Connect to 192.168.1.100 server", 
            "Email verification for test@example.com"
        ]
        
        for i, prompt in enumerate(prompts, 1):
            print(f"\nPrompt {i}: {prompt}")
            result = proxy.anonymize(prompt)
            print(f"Anonymized: {result.anon_prompt}")
            
            # Clean up - in real usage you'd store map_id for later deanonymization
            deanon = proxy.deanonymize(result.anon_prompt, result.map_id, result.signature)
            print(f"Restored: {deanon}")
        
        print("\n✅ All examples completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        
        if "Could not find anon-infer-proxy library" in str(e):
            print("\n💡 Make sure to build the library first:")
            print("   npm run build")


if __name__ == "__main__":
    example_usage()
