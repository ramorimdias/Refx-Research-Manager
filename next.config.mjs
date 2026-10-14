/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.TAURI_ENV ? 'export' : undefined,
  trailingSlash: Boolean(process.env.TAURI_ENV),
  // Tauri packages are static exports and call the separately hosted app proxy.
  // Exclude API route-handler .ts files from that export while keeping them in
  // normal hosted Next.js builds.
  pageExtensions: process.env.TAURI_ENV ? ['tsx', 'jsx'] : ['tsx', 'ts', 'jsx', 'js'],
  transpilePackages: ['pdfjs-dist'],
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    cpus: 1,
    workerThreads: true,
    webpackBuildWorker: false,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 1000,
  },
}

export default nextConfig
