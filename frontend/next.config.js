/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: "http://localhost:8003/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
