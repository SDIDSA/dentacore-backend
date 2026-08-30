#!/bin/bash

# Load DB_PASSWORD from .env if available
if [ -f ".env" ]; then
    DB_PASSWORD=$(grep -oP '^DB_PASSWORD=\K.*' .env)
    DB_PORT=$(grep -oP '^DB_PORT=\K.*' .env)
fi
DB_PORT="${DB_PORT:-5434}"

# DENTACORE_PASSWORD: fall back to DB_PASSWORD from .env, then prompt
if [ -z "$DENTACORE_PASSWORD" ]; then
    if [ -n "$DB_PASSWORD" ]; then
        DENTACORE_PASSWORD="$DB_PASSWORD"
    else
        read -r -p "Enter dentacore application user password: " DENTACORE_PASSWORD
        if [ -z "$DENTACORE_PASSWORD" ]; then
            echo "ERROR: dentacore password is required"
            exit 1
        fi
    fi
fi

# POSTGRES_PASSWORD: fall back to DB_PASSWORD from .env, else prompt
if [ -z "$POSTGRES_PASSWORD" ]; then
    if [ -n "$DB_PASSWORD" ]; then
        POSTGRES_PASSWORD="$DB_PASSWORD"
    else
        read -r -s -p "Enter postgres superuser password: " POSTGRES_PASSWORD
        echo
        if [ -z "$POSTGRES_PASSWORD" ]; then
            echo "ERROR: postgres superuser password is required"
            exit 1
        fi
    fi
fi

# Check if PostgreSQL is installed and find the correct path
PSQL_PATH=""
if command -v psql >/dev/null 2>&1; then
    PSQL_PATH="psql"
else
    echo "ERROR: PostgreSQL psql not found in PATH"
    echo "Please install PostgreSQL or add psql to your PATH"
    exit 1
fi

echo "============================================"
echo "Recreating dentacore database"
echo "============================================"
echo "Using PostgreSQL at: $(which psql)"
echo "Using port: $DB_PORT"
echo "Using passwords from .env or interactive prompt (never logged)"
echo

echo "[1/7] Creating dentacore user (if not exists)..."
export PGPASSWORD="$POSTGRES_PASSWORD"
# SQL-escape single quotes in the password ('' doubling)
DENTACORE_PW_SQL="${DENTACORE_PASSWORD//\'/\'\'}"
if $PSQL_PATH -U postgres -h localhost -p "$DB_PORT" -c "CREATE USER dentacore WITH PASSWORD '$DENTACORE_PW_SQL';" 2>/dev/null; then
    echo "User 'dentacore' created successfully"
else
    # user already exists â€” rotate its password so a changed DB_PASSWORD
    # in .env actually wins on re-run (matching recreate-db.cmd behavior)
    if $PSQL_PATH -U postgres -h localhost -p "$DB_PORT" -c "ALTER USER dentacore WITH PASSWORD '$DENTACORE_PW_SQL';"; then
        echo "User 'dentacore' already exists - password rotated to match .env"
    else
        echo "ERROR: Failed to create or update user 'dentacore'"
        exit 1
    fi
fi

echo
echo "[2/7] Dropping existing database..."
export PGPASSWORD="$POSTGRES_PASSWORD"
if ! $PSQL_PATH -U postgres -h localhost -p "$DB_PORT" -c "DROP DATABASE IF EXISTS dentacore;"; then
    echo "ERROR: Failed to drop database"
    exit 1
fi

echo
echo "[3/7] Creating new database..."
export PGPASSWORD="$POSTGRES_PASSWORD"
if ! $PSQL_PATH -U postgres -h localhost -p "$DB_PORT" -c "CREATE DATABASE dentacore OWNER dentacore;"; then
    echo "ERROR: Failed to create database"
    exit 1
fi

echo
echo "[4/7] Granting privileges to dentacore user..."
export PGPASSWORD="$POSTGRES_PASSWORD"
if ! $PSQL_PATH -U postgres -h localhost -p "$DB_PORT" -c "GRANT ALL PRIVILEGES ON DATABASE dentacore TO dentacore;"; then
    echo "ERROR: Failed to grant privileges"
    exit 1
fi

echo
echo "[5/7] Executing database schema..."
export PGPASSWORD="$DENTACORE_PASSWORD"
if ! $PSQL_PATH -U dentacore -h localhost -p "$DB_PORT" -d dentacore -f db.sql; then
    echo "ERROR: Failed to execute database schema"
    echo "Check if db.sql file exists and is readable"
    exit 1
fi

echo
echo "[6/7] Executing production system seed (seed-prod.sql)..."
export PGPASSWORD="$DENTACORE_PASSWORD"
if ! $PSQL_PATH -U dentacore -h localhost -p "$DB_PORT" -d dentacore -f seed-prod.sql; then
    echo "ERROR: Failed to execute production seed"
    echo "Check if seed-prod.sql file exists and is readable"
    exit 1
fi

echo
echo "[7/7] Executing demo seed data (seed.sql)..."
export PGPASSWORD="$DENTACORE_PASSWORD"
if ! $PSQL_PATH -U dentacore -h localhost -p "$DB_PORT" -d dentacore -f seed.sql; then
    echo "ERROR: Failed to execute seed data"
    echo "Check if seed.sql file exists and is readable"
    exit 1
fi

echo
echo "Clearing password variables..."
unset POSTGRES_PASSWORD
unset DENTACORE_PASSWORD
unset PGPASSWORD

echo
echo "============================================"
echo "Database recreation completed successfully!"
echo "============================================"
echo
echo "Database: dentacore"
echo "Owner: dentacore"
echo "Schema: Applied from db.sql"
echo "System Seed: Applied from seed-prod.sql (roles, plans, categories)"
echo "Demo Seed: Applied from seed.sql"
echo
echo "Default Admin Credentials:"
echo "Email: admin@elqods.dz"
echo "Password: Admin@2025!"
echo "(Second clinic: admin@sourire.dz / Sourire@2025!)"
echo "*** CHANGE THIS PASSWORD IMMEDIATELY! ***"
echo
echo "You can now start your application."
echo "============================================"

exit 0
