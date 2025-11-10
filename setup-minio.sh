#!/bin/bash

set -e

echo "======================================"
echo "H4KS Radio REPL - MinIO Setup Script"
echo "======================================"
echo ""

ALIAS="h4ks-s3"
ENDPOINT="https://s3-api.t3ks.com"
BUCKET="replradio-uploads"
QUOTA="3GB"
EXPIRE_DAYS="1"

echo "This script will configure MinIO bucket for H4KS Radio REPL"
echo ""
echo "Configuration:"
echo "  Endpoint: $ENDPOINT"
echo "  Bucket: $BUCKET"
echo "  Quota: $QUOTA"
echo "  Expiration: $EXPIRE_DAYS day(s)"
echo ""

read -p "Enter MinIO ACCESS_KEY: " ACCESS_KEY
read -sp "Enter MinIO SECRET_KEY: " SECRET_KEY
echo ""
echo ""

if [ -z "$ACCESS_KEY" ] || [ -z "$SECRET_KEY" ]; then
    echo "Error: ACCESS_KEY and SECRET_KEY are required"
    exit 1
fi

echo "Step 1: Configuring mc alias..."
mc alias set $ALIAS $ENDPOINT $ACCESS_KEY $SECRET_KEY

echo "Step 2: Creating bucket '$BUCKET'..."
if mc ls $ALIAS/$BUCKET 2>/dev/null; then
    echo "  Bucket already exists, skipping creation"
else
    mc mb $ALIAS/$BUCKET
    echo "  Bucket created successfully"
fi

echo "Step 3: Disabling versioning (required for lifecycle)..."
mc versioning disable $ALIAS/$BUCKET

echo "Step 4: Setting $QUOTA hard quota..."
mc admin bucket quota $ALIAS/$BUCKET --hard $QUOTA

echo "Step 5: Configuring $EXPIRE_DAYS-day expiration lifecycle..."
if mc ilm ls $ALIAS/$BUCKET | grep -q "Expiry"; then
    echo "  Lifecycle rule already exists, removing old rules..."
    mc ilm rm $ALIAS/$BUCKET --all --force
fi
mc ilm add $ALIAS/$BUCKET --expire-days "$EXPIRE_DAYS"

echo "Step 6: Setting anonymous upload policy (write-only)..."
cat > /tmp/upload-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": ["*"]},
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": ["arn:aws:s3:::replradio-uploads/*"]
    }
  ]
}
EOF

mc anonymous set-json /tmp/upload-policy.json $ALIAS/$BUCKET
rm /tmp/upload-policy.json

echo ""
echo "======================================"
echo "Configuration Complete!"
echo "======================================"
echo ""

echo "Verification:"
echo ""

echo "=== Bucket Info ==="
mc stat $ALIAS/$BUCKET

echo ""
echo "=== Quota Settings ==="
mc admin bucket quota $ALIAS/$BUCKET

echo ""
echo "=== Lifecycle Rules ==="
mc ilm ls $ALIAS/$BUCKET

echo ""
echo "=== Anonymous Policy ==="
mc anonymous get $ALIAS/$BUCKET

echo ""
echo "======================================"
echo "Setup completed successfully!"
echo ""
echo "Bucket URL: $ENDPOINT/$BUCKET"
echo ""
echo "NOTE: Files will be automatically deleted after $EXPIRE_DAYS day(s)"
echo "      Maximum bucket size: $QUOTA"
echo "      File size limit: 1MB (enforced client-side)"
echo "======================================"
