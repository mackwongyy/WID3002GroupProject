import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.68.102"
  ]
};

export default nextConfig;
