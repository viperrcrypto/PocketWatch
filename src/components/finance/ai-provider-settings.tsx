"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { useAISettings, useSaveAIProvider, useDeleteAIProvider } from "@/hooks/use-finance"
import { cn } from "@/lib/utils"
import { AI_MODEL_OPTIONS, AI_DEFAULT_MODELS } from "@/lib/finance/ai-model-options"

interface ProviderCard {
  id: string
  name: string
  description: string
  icon: string
  requiresKey: boolean
}

const PROVIDERS: ProviderCard[] = [
  {
    id: "ai_claude_cli",
    name: "Claude CLI",
    description: "Uses your local Claude Code installation. No API key needed.",
    icon: "terminal",
    requiresKey: false,
  },
  {
    id: "ai_claude_api",
    name: "Claude API",
    description: "Anthropic API with Claude Sonnet. Requires API key.",
    icon: "cloud",
    requiresKey: true,
  },
  {
    id: "ai_openai",
    name: "OpenAI",
    description: "GPT-4o Mini via OpenAI API. Requires API key.",
    icon: "smart_toy",
    requiresKey: true,
  },
  {
    id: "ai_gemini",
    name: "Gemini",
    description: "Google Gemini 2.0 Flash. Requires API key.",
    icon: "diamond",
    requiresKey: true,
  },
]

export function AIProviderSettings() {
  const { data, isLoading } = useAISettings()
  const saveProvider = useSaveAIProvider()
  const deleteProvider = useDeleteAIProvider()

  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState("")
  const autoEnabledRef = useRef(false)

  const configuredProviders = new Map(
    data?.providers?.map((p) => [p.provider, p] as const) ?? []
  )

  // Auto-enable Claude CLI if detected on the server and not yet configured
  const cliConfigured = configuredProviders.has("ai_claude_cli")
  useEffect(() => {
    if (autoEnabledRef.current || isLoading || !data || cliConfigured) return
    // Server should have auto-registered, but if not (e.g. CLI was installed after first load)
    if (data.claudeCliDetected) {
      autoEnabledRef.current = true
      saveProvider.mutate(
        { provider: "ai_claude_cli" },
        {
          onSuccess: (result) => {
            if (result.verified) {
              toast.success("Claude CLI detected and enabled automatically")
            }
          },
        }
      )
    }
  }, [isLoading, data, cliConfigured]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = (providerId: string, requiresKey: boolean) => {
    if (requiresKey && !apiKeyInput.trim()) {
      toast.error("API key is required")
      return
    }

    saveProvider.mutate(
      { provider: providerId, apiKey: requiresKey ? apiKeyInput.trim() : undefined },
      {
        onSuccess: (result) => {
          setEditingProvider(null)
          setApiKeyInput("")
          if (result.verified) {
            toast.success(`${PROVIDERS.find((p) => p.id === providerId)?.name} connected`)
          } else {
            toast.error(`Verification failed: ${result.verifyError ?? "unknown error"}`)
          }
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const handleDelete = (providerId: string) => {
    deleteProvider.mutate(providerId, {
      onSuccess: () => toast.success("Provider removed"),
      onError: (err) => toast.error(err.message),
    })
  }

  return (
    <div id="ai" className="bg-card border border-card-border rounded-xl">
      <div className="px-5 py-4 border-b border-card-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-primary/10 border border-primary/20 rounded-lg">
            <span className="material-symbols-rounded text-lg text-primary">psychology</span>
          </div>
          <div>
            <h2 className="text-foreground text-sm font-semibold">AI Intelligence</h2>
            <p className="text-foreground-muted text-xs mt-0.5">
              Connect an AI provider for personalized financial analysis
            </p>
          </div>
        </div>
      </div>

      {/* Privacy notice */}
      <div className="mx-5 mt-4 p-3 bg-success/5 border border-success/20 rounded-lg">
        <div className="flex items-start gap-2">
          <span className="material-symbols-rounded text-success flex-shrink-0 mt-0.5" style={{ fontSize: 16 }}>
            verified_user
          </span>
          <div>
            <p className="text-xs font-medium text-success">Privacy Protected</p>
            <p className="text-[11px] text-foreground-muted mt-0.5 leading-relaxed">
              Only anonymized aggregate data is shared with AI providers. No account numbers, bank names, user names, emails, or transaction IDs are ever sent.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-shimmer rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PROVIDERS.map((provider) => {
              const config = configuredProviders.get(provider.id)
              const isEditing = editingProvider === provider.id
              const isConfigured = !!config
              const isVerified = config?.verified === true

              return (
                <div
                  key={provider.id}
                  className={cn(
                    "border rounded-xl p-4 transition-colors",
                    isVerified
                      ? "border-success/30 bg-success/5"
                      : isConfigured
                        ? "border-error/30 bg-error/5"
                        : "border-card-border"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 20 }}>
                        {provider.icon}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{provider.name}</p>
                        {isVerified && (
                          <span className="flex items-center gap-1 text-success text-[10px] font-medium">
                            <span className="material-symbols-rounded" style={{ fontSize: 12 }}>check_circle</span>
                            Verified
                          </span>
                        )}
                        {isConfigured && !isVerified && (
                          <span className="flex items-center gap-1 text-error text-[10px] font-medium">
                            <span className="material-symbols-rounded" style={{ fontSize: 12 }}>error</span>
                            {config?.verifyError?.slice(0, 40) ?? "Verification failed"}
                          </span>
                        )}
                      </div>
                    </div>
                    {isConfigured && !isEditing && (
                      <button
                        onClick={() => handleDelete(provider.id)}
                        disabled={deleteProvider.isPending}
                        className="p-1 text-foreground-muted hover:text-error transition-colors rounded"
                        title="Remove"
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: 16 }}>close</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-foreground-muted mb-3 leading-relaxed">
                    {provider.description}
                  </p>

                  {isEditing ? (
                    <div className="space-y-2">
                      {provider.requiresKey && (
                        <input
                          type="password"
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          placeholder="Paste API key..."
                          className="w-full px-3 py-1.5 rounded-lg bg-background border border-card-border text-xs text-foreground font-mono"
                          onKeyDown={(e) => e.key === "Enter" && handleSave(provider.id, provider.requiresKey)}
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSave(provider.id, provider.requiresKey)}
                          disabled={saveProvider.isPending}
                          className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
                        >
                          {saveProvider.isPending ? "Verifying..." : "Save & Verify"}
                        </button>
                        <button
                          onClick={() => { setEditingProvider(null); setApiKeyInput("") }}
                          className="px-3 py-1.5 text-foreground-muted text-xs hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : !isConfigured ? (
                    <button
                      onClick={() => { setEditingProvider(provider.id); setApiKeyInput("") }}
                      className="px-3 py-1.5 border border-card-border rounded-lg text-xs font-medium text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors"
                    >
                      {provider.requiresKey ? "Add API Key" : "Enable"}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={() => { setEditingProvider(provider.id); setApiKeyInput("") }}
                        className="text-xs text-primary hover:text-primary/80 font-medium"
                      >
                        Reconfigure
                      </button>
                      {AI_MODEL_OPTIONS[provider.id] && (
                        <div>
                          <label className="block text-[10px] text-foreground-muted font-medium mb-1">Model</label>
                          <select
                            value={config?.model ?? AI_DEFAULT_MODELS[provider.id] ?? ""}
                            onChange={(e) => {
                              const selectedModel = e.target.value
                              toast.loading("Verifying model...", { id: `model-${provider.id}` })
                              saveProvider.mutate(
                                { provider: provider.id, model: selectedModel },
                                {
                                  onSuccess: (result) => {
                                    if (result.verified) {
                                      toast.success(
                                        `${AI_MODEL_OPTIONS[provider.id]?.find((m) => m.value === selectedModel)?.label ?? selectedModel} verified`,
                                        { id: `model-${provider.id}` },
                                      )
                                    } else {
                                      toast.error(
                                        `Model failed: ${result.verifyError ?? "unknown error"}`,
                                        { id: `model-${provider.id}` },
                                      )
                                    }
                                  },
                                  onError: (err) => toast.error(err.message, { id: `model-${provider.id}` }),
                                },
                              )
                            }}
                            disabled={saveProvider.isPending}
                            className="w-full px-2 py-1.5 rounded-lg bg-background border border-card-border text-xs text-foreground appearance-none cursor-pointer"
                          >
                            {AI_MODEL_OPTIONS[provider.id].map((m) => (
                              <option key={m.value} value={m.value} className="bg-card text-foreground">
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
