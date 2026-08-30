import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.234'],
  /*
   * The dev-tools badge is not shipped UI, and it lands directly on the
   * "MY STUDIO BENCH" footer label — every dev screenshot of the bench had to
   * be read around it. Off, so what we look at in dev is what ships.
   */
  devIndicators: false,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
