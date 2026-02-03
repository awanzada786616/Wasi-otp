/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Warning: Is se linting warnings ignore ho jayengi taake build pass ho jaye
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
