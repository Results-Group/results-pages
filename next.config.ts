import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  trailingSlash: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
}

export default nextConfig
