/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: "http://localhost:8003/api/:path*",
      },
      {
        source: "/api/:path*",
        destination: "http://localhost:8003/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
