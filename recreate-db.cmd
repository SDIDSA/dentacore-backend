@echo off
setlocal enabledelayedexpansion

REM Database passwords (hardcoded for development convenience)
set POSTGRES_PASSWORD=8520
set DENTACORE_PASSWORD=8520

REM Check if PostgreSQL is installed and find the correct path
set PSQL_PATH=""
if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" set PSQL_PATH="C:\Program Files\PostgreSQL\16\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\17\bin\psql.exe" set PSQL_PATH="C:\Program Files\PostgreSQL\17\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\18\bin\psql.exe" set PSQL_PATH="C:\Program Files\PostgreSQL\18\bin\psql.exe"

if %PSQL_PATH%=="" (
    echo ERROR: PostgreSQL psql.exe not found in common locations
    echo Please install PostgreSQL or update the PSQL_PATH variable
    pause
    exit /b 1
)

echo ============================================
echo Recreating DentaCore Database
echo ============================================
echo Using PostgreSQL at: %PSQL_PATH%
echo Using hardcoded passwords for development
echo.

echo [1/6] Creating dentacore user (if not exists)...
set PGPASSWORD=%POSTGRES_PASSWORD%
%PSQL_PATH% -U postgres -c "CREATE USER dentacore WITH PASSWORD '%DENTACORE_PASSWORD%';" 2>nul
if %errorlevel% equ 0 (
    echo User 'dentacore' created successfully
) else (
    echo User 'dentacore' already exists or creation failed - continuing...
)

echo.
echo [2/6] Dropping existing database...
set PGPASSWORD=%POSTGRES_PASSWORD%
%PSQL_PATH% -U postgres -c "DROP DATABASE IF EXISTS dentacore;"
if %errorlevel% neq 0 (
    echo ERROR: Failed to drop database
    pause
    exit /b 1
)

echo.
echo [3/6] Creating new database...
set PGPASSWORD=%POSTGRES_PASSWORD%
%PSQL_PATH% -U postgres -c "CREATE DATABASE dentacore OWNER dentacore;"
if %errorlevel% neq 0 (
    echo ERROR: Failed to create database
    pause
    exit /b 1
)

echo.
echo [4/6] Granting privileges to dentacore user...
set PGPASSWORD=%POSTGRES_PASSWORD%
%PSQL_PATH% -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE dentacore TO dentacore;"
if %errorlevel% neq 0 (
    echo ERROR: Failed to grant privileges
    pause
    exit /b 1
)

echo.
echo [5/6] Executing database schema...
set PGPASSWORD=%DENTACORE_PASSWORD%
%PSQL_PATH% -U dentacore -d dentacore -f db.sql
if %errorlevel% neq 0 (
    echo ERROR: Failed to execute database schema
    echo Check if db.sql file exists and is readable
    pause
    exit /b 1
)

echo.
echo [6/6] Executing seed data...
set PGPASSWORD=%DENTACORE_PASSWORD%
%PSQL_PATH% -U dentacore -d dentacore -f seed.sql
if %errorlevel% neq 0 (
    echo ERROR: Failed to execute seed data
    echo Check if seed.sql file exists and is readable
    pause
    exit /b 1
)

echo.
echo Clearing password variables...
set POSTGRES_PASSWORD=
set DENTACORE_PASSWORD=
set PGPASSWORD=

echo.
echo ============================================
echo Database recreation completed successfully!
echo ============================================
echo.
echo Database: dentacore
echo Owner: dentacore
echo Schema: Applied from db.sql
echo Seed Data: Applied from seed.sql
echo.
echo Default Admin Credentials:
echo Email: admin@dental-clinic.dz
echo Password: Admin@123456
echo *** CHANGE THIS PASSWORD IMMEDIATELY! ***
echo.
echo You can now start your application.
echo ============================================

endlocal
pause