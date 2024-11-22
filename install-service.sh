bashCopy#!/bin/bash

# Exit on any error
set -e

# Must run as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (sudo)"
    exit 1
fi

# Get absolute path of script directory
WORKING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create the service file with correct working directory
sed "s|WORKING_DIR_PLACEHOLDER|${WORKING_DIR}|g" \
    "${WORKING_DIR}/factcheck-api.service.template" > \
    "${WORKING_DIR}/factcheck-api.service"

# Copy to systemd directory
cp "${WORKING_DIR}/factcheck-api.service" /etc/systemd/system/

# Set permissions
chmod 644 /etc/systemd/system/factcheck-api.service

# Enable and start service
systemctl daemon-reload
systemctl enable factcheck-api
systemctl start factcheck-api

echo "Service installed and started successfully!"
echo "Check status with: systemctl status factcheck-api"

