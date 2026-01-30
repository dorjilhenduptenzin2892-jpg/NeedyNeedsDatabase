#!/usr/bin/env node
/*
  Helper: set Vercel environment variable via Vercel REST API.
  Usage:
    VEREL_TOKEN=your_token VERCEL_PROJECT_ID=your_project_id node scripts/set-vercel-env.js KEY VALUE

  - VEREL_TOKEN: Personal token from https://vercel.com/account
  - VERCEL_PROJECT_ID: find in Vercel project settings or use Vercel CLI `vercel env ls` output
*/

const https = require('https');

function usage() {
  console.error('Usage: VEREL_TOKEN=... VERCEL_PROJECT_ID=... node scripts/set-vercel-env.js KEY VALUE');
  process.exit(1);
}

if (!process.env.VEREL_TOKEN || !process.env.VERCEL_PROJECT_ID) {
  console.error('Missing VEREL_TOKEN or VERCEL_PROJECT_ID environment variables');
  usage();
}

const [,, key, value] = process.argv;
if (!key || !value) usage();

const body = JSON.stringify({
  key,
  value,
  target: ['production']
});

const options = {
  hostname: 'api.vercel.com',
  path: `/v9/projects/${process.env.VERCEL_PROJECT_ID}/env`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.VEREL_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('Env var set:', key);
    } else {
      console.error('Failed to set env var:', res.statusCode, data);
      process.exit(2);
    }
  });
});

req.on('error', (err) => {
  console.error('Request error:', err);
  process.exit(2);
});

req.write(body);
req.end();
