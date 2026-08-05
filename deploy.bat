@echo off
echo Building Furnisia...
call npm run build
if errorlevel 1 goto :error

echo Syncing assets (long-term cache)...
call aws s3 sync ./dist s3://furnetea-singhgamedev-site --delete --exclude "index.html" --cache-control "public, max-age=31536000, immutable"
if errorlevel 1 goto :error

echo Uploading index.html (no-cache)...
call aws s3 cp ./dist/index.html s3://furnetea-singhgamedev-site/index.html --cache-control "no-cache, no-store, must-revalidate"
if errorlevel 1 goto :error

echo Invalidating CloudFront cache for index.html...
call aws cloudfront create-invalidation --distribution-id E3D2QC0ROQB4U8 --paths "/index.html"
if errorlevel 1 goto :error

echo Deploy complete.
goto :end

:error
echo Deploy failed. Check the error above.
exit /b 1

:end
