#!/bin/bash
ng build --configuration production
npx wrangler pages deploy dist/devkit-diff-checker-web/browser --project-name=devkit-diff-checker-web --branch=main
echo "✅ Deployed to Cloudflare Pages"
