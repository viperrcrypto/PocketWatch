import type { NextConfig } from "next";
import { execSync } from "child_process";

function git(cmd: string): string {
  try { return execSync(`git ${cmd}`, { encoding: "utf8" }).trim() } catch { return "" }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_VERSION: `0.${git("rev-list --count HEAD")}.0`,
    NEXT_PUBLIC_BUILD_HASH: git("rev-parse --short HEAD"),
  },
  // Security headers defined below in second headers() block
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pbs.twimg.com",
      },
      {
        protocol: "https",
        hostname: "unavatar.io",
      },
      {
        protocol: "https",
        hostname: "abs.twimg.com",
      },
      {
        protocol: "https",
        hostname: "nft-cdn.alchemy.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
    ],
  },
  // Keep heavy server-only packages out of the client bundle
  serverExternalPackages: ["ccxt", "node-cron", "pdfjs-dist"],
  turbopack: {
    root: __dirname,
  },
  experimental: {
    optimizePackageImports: [
      "viem",
      "date-fns",
      "@tanstack/react-query",
      "sonner",
      "@radix-ui/react-avatar",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-popover",
      "@radix-ui/react-scroll-area",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s.tradingview.com https://s3.tradingview.com https://cdn.plaid.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.com wss://*.walletconnect.org https://*.web3modal.org https://*.reown.com wss://news.treeofalpha.com https://news.treeofalpha.com https://eth.llamarpc.com https://*.infura.io https://*.alchemy.com https://rpc.ankr.com https://*.base.org https://*.optimism.io https://*.arbitrum.io https://*.polygon-rpc.com https://fonts.googleapis.com https://fonts.gstatic.com https://api.alternative.me https://api.llama.fi https://coins.llama.fi https://yields.llama.fi https://swap.defillama.com https://*.defillama.com https://discord.com https://pulse.walletconnect.org https://api.openai.com https://api.dexscreener.com https://*.plaid.com",
              "frame-src 'self' https://cdn.plaid.com https://s.tradingview.com https://s3.tradingview.com",
              "worker-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              // No `upgrade-insecure-requests`: WKWebView (the Tauri desktop
              // app) doesn't treat http://localhost as trustworthy and upgrades
              // every asset to https://localhost -> TLS failure (-1200) -> black
              // window. All assets are same-origin anyway, and over the tunnel
              // Cloudflare already serves https, so the directive adds nothing.
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
