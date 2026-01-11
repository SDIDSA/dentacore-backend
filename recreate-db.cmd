@echo off
set PSQL_PATH="C:\Program Files\PostgreSQL\18\bin\psql.exe"

echo ============================================
echo Recreating DentaCore Database
echo ============================================

echo.
echo Please enter database passwords (will be used for all operations):
echo.
set /p POSTGRES_PASSWORD=Enter postgres user password: 
set /p DENTACORE_PASSWORD=Enter dentacore user password: 

echo.
echo [1/5] Dropping existing database...
set PGPASSWORD=%POSTGRES_PASSWORD%
%PSQL_PATH% -U postgres -c "DROP DATABASE IF EXISTS dentacore;"
if %errorlevel% neq 0 (
    echo ERROR: Failed to drop database
    pause
    exit /b 1
)

echo.
echo [2/5] Creating new database...
set PGPASSWORD=%POSTGRES_PASSWORD%
%PSQL_PATH% -U postgres -c "CREATE DATABASE dentacore OWNER dentacore;"
if %errorlevel% neq 0 (
    echo ERROR: Failed to create database
    pause
    exit /b 1
)

echo.
echo [3/5] Setting database owner...
set PGPASSWORD=%POSTGRES_PASSWORD%
%PSQL_PATH% -U postgres -c "ALTER DATABASE dentacore OWNER TO dentacore;"
if %errorlevel% neq 0 (
    echo ERROR: Failed to set database owner
    pause
    exit /b 1
)

echo.
echo [4/5] Executing database schema...
set PGPASSWORD=%DENTACORE_PASSWORD%
%PSQL_PATH% -U dentacore -d dentacore -f db.sql
if %errorlevel% neq 0 (
    echo ERROR: Failed to execute database schema
    pause
    exit /b 1
)

echo.
echo [5/5] Executing seed data...
set PGPASSWORD=%DENTACORE_PASSWORD%
%PSQL_PATH% -U dentacore -d dentacore -f seed.sql
if %errorlevel% neq 0 (
    echo ERROR: Failed to execute seed data
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
echo You can now start your application.
echo ============================================

pause