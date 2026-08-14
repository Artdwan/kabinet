#!/bin/bash
set -e
cd "$(dirname "$0")"

export NVM_DIR="/var/www/fastuser/data/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm use default 2>/dev/null || nvm use --lts 2>/dev/null || true
fi

echo "== node/npm =="
node -v
npm -v

echo "== npm install =="
npm install

echo "== build =="
npm run build

mkdir -p data uploads

if [ ! -f .env ]; then
  JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
  cat > .env <<ENVEOF
PORT=4000
DATABASE_PATH=/var/www/fastuser/data/kabinet-api/data/kabinet.db
UPLOAD_DIR=/var/www/fastuser/data/kabinet-api/uploads
JWT_SECRET=${JWT_SECRET}
NODE_ENV=production
ENVEOF
  echo "created .env with a freshly generated JWT_SECRET"
else
  echo ".env already exists, leaving as is"
fi

echo "== migrate =="
npm run db:migrate

echo "== seed (safe to re-run) =="
npm run db:seed || true

echo "== pm2 =="
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

pm2 delete kabinet-api >/dev/null 2>&1 || true
pm2 start dist/index.js --name kabinet-api --cwd "$(pwd)"
pm2 save

sleep 2
echo "== health check =="
curl -s http://127.0.0.1:4000/api/health || echo "HEALTH CHECK FAILED"
echo
echo "=== DONE ==="
