@echo off
title JanVyapar Batch Parser (Test A)
echo ======================================================
echo    JanVyapar Batch Runner (schema.json contract)
echo ======================================================
echo.
if "%~1"=="" (
    node scripts/parse-batch.mjs
) else (
    node scripts/parse-batch.mjs %1 %2
)
echo.
pause
