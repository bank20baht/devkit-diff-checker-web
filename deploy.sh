#!/bin/bash
ng build --configuration production
aws s3 sync dist/<project-name>/browser/ s3://diff-checker.20baht.com/ --delete
echo "✅ Deployed to https://diff-checker.20baht.com"
echo "ถ้าไม่เห็นการเปลี่ยนแปลง → purge cache ที่ Cloudflare"
