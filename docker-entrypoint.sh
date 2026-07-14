#!/bin/sh
set -eu

# Coolify can attach a new persistent volume as root. SQLite also needs to
# create its WAL and SHM sibling files, so prepare the whole directory first.
mkdir -p /app/data
chown -R nextjs:nodejs /app/data

exec gosu nextjs "$@"
