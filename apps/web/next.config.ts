import { PrismaPlugin } from '@prisma/nextjs-monorepo-workaround-plugin';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@decoy/game-engine', '@decoy/types', '@decoy/ui'],
  webpack(config, { isServer }) {
    if (isServer) {
      config.plugins.push(new PrismaPlugin());
    }

    return config;
  }
};

export default nextConfig;
