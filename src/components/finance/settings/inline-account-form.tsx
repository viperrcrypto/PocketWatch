"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useCreateManualAccount } from "@/hooks/finance"

interface Props {
  onCreated: (account: { id: string; name: string }) => void
  onCancel: () => void
}

export function InlineAccountForm({ onCreated, onCancel }: Props) {
  const [name, setName] = useState("")
  const [mask, setMask] = useState("")
  const [type, setType] = useState("credit")
  const createAccount = useCreateManualAccount()

  const handleCreate = () => {
    if (!name.trim()) return
    createAccount.mutate(
      { name: name.trim(), mask: mask.trim() || undefined, type },
      {
        onSuccess: (res) => {
          onCreated({ id: res.id, name: res.name })
          toast.success(`Created ${res.name}`)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-lg p-4 space-y-3">
      <p className="text-xs font-semibold text-primary">New Manual Account</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs text-foreground-muted mb-1">Account Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kast Card"
            className="w-full bg-transparent border border-card-border rounded-lg py-2 px-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-xs text-foreground-muted mb-1">Last 4 Digits</label>
          <input
            type="text"
            value={mask}
            onChange={(e) => setMask(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="2940"
            maxLength={4}
            className="w-full bg-transparent border border-card-border rounded-lg py-2 px-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-xs text-foreground-muted mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full bg-transparent border border-card-border rounded-lg py-2 px-3 text-sm outline-none focus:border-primary appearance-none cursor-pointer"
          >
            <option value="credit" className="bg-card">Credit / Debit Card</option>
            <option value="checking" className="bg-card">Checking</option>
            <option value="savings" className="bg-card">Savings</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleCreate}
          disabled={!name.trim() || createAccount.isPending}
          className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
        >
          {createAccount.isPending ? "Creating..." : "Create Account"}
        </button>
        <button onClick={onCancel} className="btn-ghost text-xs px-3 py-1.5">
          Cancel
        </button>
      </div>
    </div>
  )
}
