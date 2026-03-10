"use client"

import { getChainColor } from "@/lib/portfolio/chains"

interface ChainIconProps {
  chainId: string
  size?: number
  className?: string
}

export function ChainIcon({ chainId, size = 20, className }: ChainIconProps) {
  const key = chainId.toUpperCase()
  const Renderer = ICONS[key]
  if (Renderer) {
    return (
      <span className={`inline-flex flex-shrink-0 ${className ?? ""}`} style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden" }}>
        <Renderer size={size} />
      </span>
    )
  }
  // Fallback: colored circle with first letter
  const color = getChainColor(chainId)
  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 font-data text-foreground ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color,
        fontSize: size * 0.45,
        fontWeight: 700,
      }}
    >
      {chainId.charAt(0).toUpperCase()}
    </span>
  )
}

// ─── SVG Icons ───

function Ethereum({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <path d="M16.1 4v8.87l7.5 3.35L16.1 4z" fill="white" fillOpacity="0.6" />
      <path d="M16.1 4L8.6 16.22l7.5-3.35V4z" fill="white" />
      <path d="M16.1 21.97v6.02l7.5-10.37-7.5 4.35z" fill="white" fillOpacity="0.6" />
      <path d="M16.1 27.99v-6.02L8.6 17.62l7.5 10.37z" fill="white" />
      <path d="M16.1 20.57l7.5-4.35-7.5-3.35v7.7z" fill="white" fillOpacity="0.2" />
      <path d="M8.6 16.22l7.5 4.35v-7.7l-7.5 3.35z" fill="white" fillOpacity="0.5" />
    </svg>
  )
}

function Bitcoin({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#F7931A" />
      <path
        d="M21.2 13.5c.3-2.1-1.3-3.2-3.4-4l.7-2.8-1.7-.4-.7 2.7c-.4-.1-.9-.2-1.3-.3l.7-2.8-1.7-.4-.7 2.8c-.3-.1-.7-.2-1-.2l-2.4-.6-.4 1.8s1.3.3 1.2.3c.7.2.8.6.8 1l-.8 3.3s.1 0 .2.1h-.2l-1.2 4.7c-.1.2-.3.5-.8.4 0 0-1.3-.3-1.3-.3L7 20l2.2.6c.4.1.8.2 1.2.3l-.7 2.8 1.7.4.7-2.8c.5.1.9.2 1.3.3l-.7 2.8 1.7.4.7-2.9c3 .6 5.2.3 6.1-2.3.8-2.1 0-3.4-1.6-4.2 1.1-.2 2-1 2.3-2.5zm-4.1 5.7c-.5 2.2-4.2 1-5.4.7l1-3.9c1.2.3 5 .9 4.4 3.2zm.6-5.7c-.5 2-3.5.9-4.5.7l.9-3.5c1 .2 4.1.7 3.6 2.8z"
        fill="white"
      />
    </svg>
  )
}

function Solana({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#000" />
      <path d="M10.1 20.5a.5.5 0 01.35-.14h12.5c.23 0 .34.27.18.43l-2.25 2.32a.5.5 0 01-.36.14H8.02a.25.25 0 01-.18-.43l2.25-2.32z" fill="url(#sol_a)" />
      <path d="M10.1 9a.5.5 0 01.35-.15h12.5c.23 0 .34.28.18.43l-2.25 2.32a.5.5 0 01-.36.15H8.02a.25.25 0 01-.18-.43L10.1 9z" fill="url(#sol_b)" />
      <path d="M21.88 14.7a.5.5 0 00-.36-.14H9.02c-.23 0-.34.27-.18.43l2.25 2.32a.5.5 0 00.36.14h12.5c.23 0 .34-.27.18-.43l-2.25-2.32z" fill="url(#sol_c)" />
      <defs>
        <linearGradient id="sol_a" x1="22" y1="5" x2="9" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FFA3" />
          <stop offset="1" stopColor="#DC1FFF" />
        </linearGradient>
        <linearGradient id="sol_b" x1="18" y1="3" x2="6" y2="23" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FFA3" />
          <stop offset="1" stopColor="#DC1FFF" />
        </linearGradient>
        <linearGradient id="sol_c" x1="20" y1="4" x2="8" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FFA3" />
          <stop offset="1" stopColor="#DC1FFF" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function Optimism({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#FF0420" />
      <path
        d="M11.2 20.3c-1.4 0-2.5-.4-3.3-1.1-.8-.8-1.2-1.8-1.2-3.2 0-1.8.5-3.3 1.5-4.5 1-1.2 2.4-1.8 4-1.8 1.4 0 2.5.4 3.3 1.2.7.8 1.1 1.8 1.1 3.1 0 1.8-.5 3.3-1.5 4.5-1 1.2-2.3 1.8-3.9 1.8zm.2-2c.8 0 1.4-.4 1.9-1.1.5-.7.7-1.7.7-3 0-.8-.2-1.4-.5-1.9-.3-.4-.8-.7-1.5-.7-.8 0-1.4.4-1.9 1.1-.5.7-.7 1.7-.7 3 0 .8.2 1.4.5 1.9.4.4.9.7 1.5.7zM17.7 20.1l1.8-8.2h3.6c1.2 0 2 .3 2.6.8.5.5.8 1.2.8 2.1 0 1.2-.4 2.1-1.1 2.8-.7.7-1.8 1-3.1 1h-1.9l-.6 2.5h-2.1zm4-4.2h1.2c.6 0 1-.1 1.4-.4.3-.3.5-.7.5-1.2 0-.4-.1-.6-.3-.8-.2-.2-.6-.3-1.1-.3h-1.2l-.5 2.7z"
        fill="white"
      />
    </svg>
  )
}

function Arbitrum({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#2D374B" />
      <path d="M17.3 8l6.4 11.1c.3.5.3 1.1 0 1.6l-2 3.4-.1.1-4.3-7.5 3-5.2L17.3 8z" fill="#28A0F0" />
      <path d="M15.7 17.3l-2.4 4.1 4.3 4.3h2.3l.1-.1 2-3.4-6.3-4.9z" fill="#28A0F0" />
      <path d="M8.3 19.1c-.3-.5-.3-1.1 0-1.6L14.7 8l3 3.5-5.5 9.5-2.3-1.3-1.6-.6z" fill="white" />
      <path d="M12.2 21l-2.3-1.3 2.4 4.1L14.6 26h2.3l-4.7-5z" fill="white" />
    </svg>
  )
}

function Base({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#0052FF" />
      <path
        d="M15.9 26.8c5.96 0 10.8-4.84 10.8-10.8S21.86 5.2 15.9 5.2C10.26 5.2 5.6 9.56 5.1 15.1h14.3v1.8H5.1c.5 5.54 5.16 9.9 10.8 9.9z"
        fill="white"
      />
    </svg>
  )
}

function Polygon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#8247E5" />
      <path
        d="M21 12.7c-.4-.2-.9-.2-1.2 0l-2.9 1.7-2 1.1-2.9 1.7c-.4.2-.9.2-1.2 0l-2.3-1.3c-.4-.2-.6-.6-.6-1.1v-2.5c0-.4.2-.9.6-1.1l2.2-1.3c.4-.2.9-.2 1.2 0l2.2 1.3c.4.2.6.6.6 1.1v1.7l2-1.1v-1.7c0-.4-.2-.9-.6-1.1l-4.2-2.4c-.4-.2-.9-.2-1.2 0l-4.2 2.4c-.4.2-.6.6-.6 1.1v4.9c0 .4.2.9.6 1.1l4.2 2.4c.4.2.9.2 1.2 0l2.9-1.7 2-1.1 2.9-1.7c.4-.2.9-.2 1.2 0l2.2 1.3c.4.2.6.6.6 1.1v2.5c0 .4-.2.9-.6 1.1l-2.2 1.3c-.4.2-.9.2-1.2 0l-2.2-1.3c-.4-.2-.6-.6-.6-1.1v-1.7l-2 1.1v1.7c0 .4.2.9.6 1.1l4.2 2.4c.4.2.9.2 1.2 0l4.2-2.4c.4-.2.6-.6.6-1.1v-4.9c0-.4-.2-.9-.6-1.1L21 12.7z"
        fill="white"
      />
    </svg>
  )
}

function Avalanche({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#E84142" />
      <path
        d="M20.5 21.5h3.1c.6 0 .9-.1 1.1-.4.2-.3.2-.6 0-1.1l-7.6-13.4c-.2-.4-.5-.6-.9-.6s-.7.2-.9.6l-2.2 3.9 4.4 7.8.5.8c.1.2.2.3.3.3h2.2zm-8.8 0h4.3l-2.2-3.8-2.1 3.5c-.1.2 0 .3.1.3h-.1z"
        fill="white"
      />
    </svg>
  )
}

function Gnosis({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#04795B" />
      <path
        d="M12 12.5c1.3-1.1 2.9-1.7 4.6-1.7h.1c1.6 0 3.2.6 4.5 1.7l3-3c-2-1.9-4.7-3-7.5-3s-5.5 1.1-7.5 3l2.8 3zm-2.3 2.3l-3-3C5 13.7 4 16.1 4 18.8h4.2c0-1.6.6-3 1.5-4zM20.8 14.7c1 1.1 1.5 2.5 1.5 4.1H26.5c0-2.7-1-5.1-2.8-6.9l-2.9 2.8z"
        fill="white"
      />
      <path
        d="M16.7 22.9c-2.7 0-5.1-1.4-6.4-3.6l-3 2.2c2 3.4 5.6 5.6 9.5 5.6 3.8 0 7.4-2.2 9.4-5.5l-3-2.2c-1.4 2.1-3.8 3.5-6.5 3.5z"
        fill="white"
      />
    </svg>
  )
}

function BinanceSmartChain({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#F0B90B" />
      <path d="M16 6l3.2 3.2-5.9 5.9-3.2-3.2L16 6z" fill="white" />
      <path d="M21.1 11.1l3.2 3.2-3.2 3.2-3.2-3.2 3.2-3.2z" fill="white" />
      <path d="M10.9 11.1l3.2 3.2-3.2 3.2-3.2-3.2 3.2-3.2z" fill="white" />
      <path d="M16 16.2l3.2 3.2-3.2 3.2-3.2-3.2 3.2-3.2z" fill="white" />
      <path d="M7.7 14.3L9 13l3.2 3.2L9 19.4l-1.3-1.3 1.9-1.9v-2.6L7.7 14.3z" fill="white" />
      <path d="M24.3 14.3L23 13l-3.2 3.2 3.2 3.2 1.3-1.3-1.9-1.9v-2.6l1.9.7z" fill="white" />
    </svg>
  )
}

function ZkSync({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#8C8DFC" />
      <path d="M16 7l-9 9 9 9 9-9-9-9z" fill="white" fillOpacity="0.3" />
      <path d="M16 10l-6 6 6 6 6-6-6-6z" fill="white" />
      <path d="M12.5 16l3.5 3.5 3.5-3.5-3.5-3.5-3.5 3.5z" fill="#8C8DFC" />
    </svg>
  )
}

function Linea({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#1A1A2E" />
      <path d="M11 8v16h3V11h7v3h-5v3h5v3h-7v4h10V8H11z" fill="#61DFFF" />
    </svg>
  )
}

function Scroll({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#FFEEDA" />
      <path
        d="M10 9c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2v1h-2V9h-8v14h5v2h-5c-1.1 0-2-.9-2-2V9z"
        fill="#7E4B28"
      />
      <path
        d="M14 11h8c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2h-3v-2h3V13h-8v8h-2V13c0-1.1.9-2 2-2z"
        fill="#7E4B28"
        fillOpacity="0.6"
      />
      <circle cx="21" cy="23" r="2" fill="#7E4B28" />
    </svg>
  )
}

function Blast({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#1A1A2E" />
      <path
        d="M12 7h8l-2 4h4l-8 10 2-6h-4l3-5h-4l1-3z"
        fill="#FCFC03"
      />
    </svg>
  )
}

function Mantle({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#2ECC94" />
      <path
        d="M8 22V10l4 6 4-6 4 6 4-6v12"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

function Mode({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#1A1A2E" />
      <circle cx="16" cy="16" r="5" fill="#DFFE00" />
      <path
        d="M16 6v5M16 21v5M6 16h5M21 16h5"
        stroke="#DFFE00"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Fantom({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#1969FF" />
      <path
        d="M14.5 8h3v2.5h3.5v3h-3.5v2h3v3h-3v5.5h-3v-5.5h-3v-3h3v-2h-3.5v-3h3.5V8z"
        fill="white"
      />
    </svg>
  )
}

function Zora({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#2B5DF0" />
      <circle cx="16" cy="16" r="9" fill="url(#zora_grad)" />
      <path
        d="M11 12h8l-6 8h8"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <defs>
        <linearGradient id="zora_grad" x1="7" y1="7" x2="25" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCB4FF" />
          <stop offset="0.33" stopColor="#FF8B8B" />
          <stop offset="0.66" stopColor="#FFC876" />
          <stop offset="1" stopColor="#2B5DF0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function Berachain({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#804A26" />
      <circle cx="12" cy="12" r="3" fill="white" fillOpacity="0.9" />
      <circle cx="20" cy="12" r="3" fill="white" fillOpacity="0.9" />
      <ellipse cx="16" cy="19" rx="6" ry="4.5" fill="white" fillOpacity="0.9" />
      <circle cx="13" cy="18.5" r="1.5" fill="#804A26" />
      <circle cx="19" cy="18.5" r="1.5" fill="#804A26" />
      <ellipse cx="16" cy="20.5" rx="2" ry="1" fill="#804A26" />
    </svg>
  )
}

function Monad({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#836EF9" />
      <path
        d="M8 22V10l4 6 4-6 4 6 4-6v12"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

const ICONS: Record<string, (props: { size: number }) => React.ReactNode> = {
  ETH: Ethereum,
  BTC: Bitcoin,
  SOL: Solana,
  OPTIMISM: Optimism,
  ARBITRUM_ONE: Arbitrum,
  BASE: Base,
  POLYGON_POS: Polygon,
  AVAX: Avalanche,
  GNOSIS: Gnosis,
  BSC: BinanceSmartChain,
  ZKSYNC: ZkSync,
  LINEA: Linea,
  SCROLL: Scroll,
  BLAST: Blast,
  MANTLE: Mantle,
  MODE: Mode,
  FANTOM: Fantom,
  ZORA: Zora,
  BERACHAIN: Berachain,
  MONAD: Monad,
}
