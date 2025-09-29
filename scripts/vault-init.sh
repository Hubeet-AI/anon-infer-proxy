#!/bin/sh

# Vault initialization script for anon-infer-proxy
# This script sets up the necessary secret engines and policies in Vault

set -e

echo "🔐 Initializing Vault for anon-infer-proxy..."

# Wait for Vault to be ready
echo "⏳ Waiting for Vault to be ready..."
until vault status > /dev/null 2>&1; do
  echo "Waiting for Vault..."
  sleep 2
done

echo "✅ Vault is ready!"

# Enable KV v2 secret engine if not already enabled
echo "🔧 Enabling KV v2 secret engine..."
if ! vault secrets list | grep -q "secret/"; then
  vault secrets enable -path=secret kv-v2
  echo "✅ KV v2 secret engine enabled at 'secret/'"
else
  echo "✅ KV v2 secret engine already enabled"
fi

# Create a policy for anon-proxy service
echo "📝 Creating anon-proxy policy..."
vault policy write anon-proxy - <<EOF
# Allow anon-proxy to read/write mappings
path "secret/data/anon-proxy-mappings/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "secret/metadata/anon-proxy-mappings/*" {
  capabilities = ["list", "read", "delete"]
}

# Allow anon-proxy to list its own paths
path "secret/metadata/anon-proxy-mappings" {
  capabilities = ["list"]
}

# Health check capability
path "sys/health" {
  capabilities = ["read"]
}

# Mount information
path "sys/mounts" {
  capabilities = ["read"]
}
EOF

echo "✅ anon-proxy policy created"

# Create a token for the anon-proxy service (in production, use auth methods)
echo "🎫 Creating service token..."
ANON_PROXY_TOKEN=$(vault write -field=token auth/token/create \
  policies=anon-proxy \
  ttl=24h \
  renewable=true \
  display_name="anon-proxy-service")

echo "✅ Service token created: ${ANON_PROXY_TOKEN}"

# Store some test data for verification
echo "🧪 Creating test data..."
vault kv put secret/anon-proxy-mappings/test-mapping \
  data='{"test": "data", "created_at": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}'

echo "✅ Test data created"

# Verify the setup
echo "🔍 Verifying setup..."
if vault kv get secret/anon-proxy-mappings/test-mapping > /dev/null 2>&1; then
  echo "✅ Vault setup verification successful"
else
  echo "❌ Vault setup verification failed"
  exit 1
fi

echo "🎉 Vault initialization complete!"
echo ""
echo "💡 Configuration for anon-infer-proxy:"
echo "   VAULT_ENDPOINT=http://vault:8200"
echo "   VAULT_TOKEN=${VAULT_TOKEN:-$ANON_PROXY_TOKEN}"
echo "   VAULT_MOUNT_PATH=secret"
echo ""
echo "🚀 You can now start the anon-infer-proxy service"
