#!/bin/bash
# Tự động cd vào thư mục chứa script này (tương đối, hoạt động ở bất kỳ máy nào)
cd "$(dirname "$0")"

# Check if server already running
if curl -s http://127.0.0.1:8080/ > /dev/null 2>&1; then
  echo "Server already running on :8080"
  exit 0
fi

npm run dev &
sleep 5
echo "Dev server started"
