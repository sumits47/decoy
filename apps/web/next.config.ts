import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@decoy/game-engine', '@decoy/types', '@decoy/ui']
};

export default nextConfig;
