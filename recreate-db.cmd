@echo off
setlocal enabledelayedexpansion

REM Load DB_PASSWORD from .env if available
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
        if "%%a"=="DB_PASSWORD" set "DB_PASSWORD=%%b"
        if "%%a"=="DB_PORT" set "DB_PORT=%%b"
    )
)
if "%DB_PORT%"=="" set "DB_PORT=5434"

REM DENTACORE_PASSWORD: fall back to DB_PASSWORD from .env, then prompt
if "%DENTACORE_PASSWORD%"=="" (
    if not "%DB_PASSWORD%"=="" (
        set "DENTACORE_PASSWORD=%DB_PASSWORD%"
    ) else (
        set /p DENTACORE_PASSWORD="Enter dentacore application user password: "
        if "!DENTACORE_PASSWORD!"=="" (
            echo ERROR: dentacore password is required
            pause
            exit /b 1
        )
    )
)

REM POSTGRES_PASSWORD: fall back to DB_PASSWORD from .env, else prompt
if "%POSTGRES_PASSWORD%"=="" (
    if not "%DB_PASSWORD%"=="" (
        set "POSTGRES_PASSWORD=%DB_PASSWORD%"
    ) else (
        set /p POSTGRES_PASSWORD="Enter postgres superuser password: "
        if "!POSTGRES_PASSWORD!"=="" (
            echo ERROR: postgres superuser password is required
            pause
            exit /b 1
        )
    )
)

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
echo Recreating dentacore database
echo ============================================
echo Using PostgreSQL at: %PSQL_PATH%
echo Using port: %DB_PORT%
echo Using passwords from .env or interactive prompt (never logged)
echo.

echo.
echo [1/7] Dropping existing database...
set PGPASSWORD=%POSTGRES_PASSWORD%
%PSQL_PATH% -U postgres -p %DB_PORT% -c "DROP DATABASE IF EXISTS dentacore;"
if %errorlevel% neq 0 (
    echo ERROR: Failed to drop database
    pause
    exit /b 1
)

echo [2/7] recreating dentacore user (if not exists)...
set PGPASSWORD=%POSTGRES_PASSWORD%
REM SQL-escape single quotes in the password ('' doubling)
set "DENTACORE_PW_SQL=!DENTACORE_PASSWORD:'=''!"
%PSQL_PATH% -U postgres -p %DB_PORT% -c "DROP USER IF EXISTS dentacore;" 2>nul
%PSQL_PATH% -U postgres -p %DB_PORT% -c "CREATE USER dentacore WITH PASSWORD '!DENTACORE_PW_SQL!';" 2>nul
if %errorlevel% equ 0 (
    echo User 'dentacore' recreated successfully
) else (
    echo User 'dentacore' couldn't be dropped or recreated - continuing...
)

echo.
echo [3/7] Creating new database...
set PGPASSWORD=%POSTGRES_PASSWORD%
%PSQL_PATH% -U postgres -p %DB_PORT% -c "CREATE DATABASE dentacore OWNER dentacore;"
if %errorlevel% neq 0 (
    echo ERROR: Failed to create database
    pause
    exit /b 1
)

echo.
echo [4/7] Granting privileges to dentacore user...
set PGPASSWORD=%POSTGRES_PASSWORD%
%PSQL_PATH% -U postgres -p %DB_PORT% -c "GRANT ALL PRIVILEGES ON DATABASE dentacore TO dentacore;"
if %errorlevel% neq 0 (
    echo ERROR: Failed to grant privileges
    pause
    exit /b 1
)

echo.
echo [5/7] Executing database schema...
set PGPASSWORD=%DENTACORE_PASSWORD%
%PSQL_PATH% -U dentacore -d dentacore -p %DB_PORT% -f db.sql
if %errorlevel% neq 0 (
    echo ERROR: Failed to execute database schema
    echo Check if db.sql file exists and is readable
    pause
    exit /b 1
)

echo.
echo [6/7] Executing production system seed (seed-prod.sql)...
set PGPASSWORD=%DENTACORE_PASSWORD%
%PSQL_PATH% -U dentacore -d dentacore -p %DB_PORT% -f seed-prod.sql
if %errorlevel% neq 0 (
    echo ERROR: Failed to execute production seed
    echo Check if seed-prod.sql file exists and is readable
    pause
    exit /b 1
)

echo.
echo [7/7] Executing demo seed data (seed.sql)...
set PGPASSWORD=%DENTACORE_PASSWORD%
%PSQL_PATH% -U dentacore -d dentacore -p %DB_PORT% -f seed.sql
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
echo System Seed: Applied from seed-prod.sql (roles, plans, categories)
echo Demo Seed: Applied from seed.sql
echo.
echo Default Admin Credentials:
echo Email: admin@elqods.dz
echo Password: Admin@2025!
echo (Second clinic: admin@sourire.dz / Sourire@2025!)
echo *** CHANGE THIS PASSWORD IMMEDIATELY! ***
echo.
echo You can now start your application.
echo ============================================

endlocal
pause