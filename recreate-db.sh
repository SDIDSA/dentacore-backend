#!/bin/bash

# Database passwords (hardcoded for development convenience)
POSTGRES_PASSWORD="8520"
DENTACORE_PASSWORD="8520"

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
echo "Recreating DentaCore Database"
echo "============================================"
echo "Using PostgreSQL at: $(which psql)"
echo "Using hardcoded passwords for development"
echo

echo "[1/6] Creating dentacore user (if not exists)..."
export PGPASSWORD="$POSTGRES_PASSWORD"
if $PSQL_PATH -U postgres -c "CREATE USER dentacore WITH PASSWORD '$DENTACORE_PASSWORD';" 2>/dev/null; then
    echo "User 'dentacore' created successfully"
else
    echo "User 'dentacore' already exists or creation failed - continuing..."
fi

echo
echo "[2/6] Dropping existing database..."
export PGPASSWORD="$POSTGRES_PASSWORD"
if ! $PSQL_PATH -U postgres -h localhost -c "DROP DATABASE IF EXISTS dentacore;"; then
    echo "ERROR: Failed to drop database"
    echo "Try running: sudo -u postgres ./recreate-db.sh"
    exit 1
fi

echo
echo "[3/6] Creating new database..."
export PGPASSWORD="$POSTGRES_PASSWORD"
if ! $PSQL_PATH -U postgres -h localhost -c "CREATE DATABASE dentacore OWNER dentacore;"; then
    echo "ERROR: Failed to create database"
    exit 1
fi

echo
echo "[4/6] Granting privileges to dentacore user..."
export PGPASSWORD="$POSTGRES_PASSWORD"
if ! $PSQL_PATH -U postgres -h localhost -c "GRANT ALL PRIVILEGES ON DATABASE dentacore TO dentacore;"; then
    echo "ERROR: Failed to grant privileges"
    exit 1
fi

echo
echo "[5/6] Executing database schema..."
export PGPASSWORD="$DENTACORE_PASSWORD"
if ! $PSQL_PATH -h localhost -U dentacore -d dentacore -f db.sql; then
    echo "ERROR: Failed to execute database schema"
    echo "Check if db.sql file exists and is readable"
    exit 1
fi

echo
echo "[6/6] Executing seed data..."
export PGPASSWORD="$DENTACORE_PASSWORD"
if ! $PSQL_PATH -h localhost -U dentacore -d dentacore -f seed.sql; then
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
echo "Seed Data: Applied from seed.sql"
echo
echo "Default Admin Credentials:"
echo "Email: admin@dental-clinic.dz"
echo "Password: Admin@123456"
echo "*** CHANGE THIS PASSWORD IMMEDIATELY! ***"
echo
echo "You can now start your application."
echo "============================================"

exit 0
