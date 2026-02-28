/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', '@anthropic-ai/sdk'],
};
module.exports = nextConfig;
