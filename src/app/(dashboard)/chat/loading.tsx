export default function ChatLoading() {
  return (
    <div className="flex gap-4 h-[calc(100vh-7rem)] max-h-[calc(100vh-7rem)]">
      {/* Thread sidebar — desktop only */}
      <div className="hidden lg:flex flex-col w-64 shrink-0 card border border-card-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 h-12 border-b border-card-border shrink-0">
          <div className="h-3 w-16 animate-shimmer rounded" />
          <div className="h-5 w-5 animate-shimmer rounded" />
        </div>
        <div className="flex-1 p-2 space-y-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 w-full animate-shimmer rounded-lg" />
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col card border border-card-border rounded-xl overflow-hidden min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 h-12 border-b border-card-border shrink-0">
          <div className="h-5 w-5 animate-shimmer rounded" />
          <div className="h-4 w-32 animate-shimmer rounded" />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden px-4 md:px-6 py-4">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex justify-end">
              <div className="h-12 w-2/3 animate-shimmer rounded-2xl rounded-br-md" />
            </div>
            <div className="flex justify-start">
              <div className="h-20 w-3/4 animate-shimmer rounded-2xl rounded-bl-md" />
            </div>
            <div className="flex justify-end">
              <div className="h-10 w-1/2 animate-shimmer rounded-2xl rounded-br-md" />
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-card-border px-4 md:px-6 py-3">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <div className="flex-1 h-10 animate-shimmer rounded-xl" />
            <div className="w-10 h-10 animate-shimmer rounded-xl shrink-0" />
          </div>
        </div>
      </div>
    </div>
  )
}
