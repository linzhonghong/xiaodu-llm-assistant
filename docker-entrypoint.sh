#!/bin/sh
set -e

mkdir -p /app/data
chown -R node:node /app/data
chmod u+rwx /app/data || true
echo "xiaodu entrypoint: data directory status:"
ls -ld /app/data
gosu node sh -c 'test -w /app/data && echo "xiaodu entrypoint: node can write /app/data" || echo "xiaodu entrypoint: node cannot write /app/data"'

exec gosu node "$@"
