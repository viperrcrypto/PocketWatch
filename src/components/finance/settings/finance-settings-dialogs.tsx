"use client"

import { ConfirmDialog } from "@/components/finance/confirm-dialog"

interface FinanceSettingsDialogsProps {
  showDeleteConfirm: boolean
  onCloseDeleteConfirm: () => void
  onConfirmDelete: () => void
  deleteLoading: boolean

  disconnectTarget: { id: string; name: string } | null
  onCloseDisconnect: () => void
  onConfirmDisconnect: () => void
  disconnectLoading: boolean

  showPlaidDisconnect: boolean
  onClosePlaidDisconnect: () => void
  onConfirmPlaidDisconnect: () => void
  plaidDisconnectLoading: boolean

  showSFDisconnect: boolean
  onCloseSFDisconnect: () => void
  onConfirmSFDisconnect: () => void
  sfDisconnectLoading: boolean

  removeAccountTarget: { id: string; name: string } | null
  onCloseRemoveAccount: () => void
  onConfirmRemoveAccount: () => void
  removeAccountLoading: boolean
}

export function FinanceSettingsDialogs({
  showDeleteConfirm,
  onCloseDeleteConfirm,
  onConfirmDelete,
  deleteLoading,
  disconnectTarget,
  onCloseDisconnect,
  onConfirmDisconnect,
  disconnectLoading,
  showPlaidDisconnect,
  onClosePlaidDisconnect,
  onConfirmPlaidDisconnect,
  plaidDisconnectLoading,
  showSFDisconnect,
  onCloseSFDisconnect,
  onConfirmSFDisconnect,
  sfDisconnectLoading,
  removeAccountTarget,
  onCloseRemoveAccount,
  onConfirmRemoveAccount,
  removeAccountLoading,
}: FinanceSettingsDialogsProps) {
  return (
    <>
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={onCloseDeleteConfirm}
        onConfirm={onConfirmDelete}
        title="Delete Plaid credentials?"
        description="This will remove your Plaid API keys. Existing bank connections will remain but you won't be able to add new ones until you reconfigure."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteLoading}
      />

      <ConfirmDialog
        open={!!disconnectTarget}
        onClose={onCloseDisconnect}
        onConfirm={onConfirmDisconnect}
        title={`Disconnect ${disconnectTarget?.name ?? "institution"}?`}
        description="This will remove the connection and all associated accounts and transactions. This cannot be undone."
        confirmLabel="Disconnect"
        variant="danger"
        isLoading={disconnectLoading}
      />

      <ConfirmDialog
        open={showPlaidDisconnect}
        onClose={onClosePlaidDisconnect}
        onConfirm={onConfirmPlaidDisconnect}
        title="Disconnect Plaid?"
        description="This will remove all Plaid bank connections, accounts, transactions, and wipe your API keys. You can reconnect with new keys afterward."
        confirmLabel="Disconnect"
        variant="danger"
        isLoading={plaidDisconnectLoading}
      />

      <ConfirmDialog
        open={showSFDisconnect}
        onClose={onCloseSFDisconnect}
        onConfirm={onConfirmSFDisconnect}
        title="Disconnect SimpleFIN?"
        description="This will remove all SimpleFIN accounts, transactions, and wipe the access token. You can reconnect with a new setup token afterward."
        confirmLabel="Disconnect"
        variant="danger"
        isLoading={sfDisconnectLoading}
      />

      <ConfirmDialog
        open={!!removeAccountTarget}
        onClose={onCloseRemoveAccount}
        onConfirm={onConfirmRemoveAccount}
        title={`Remove ${removeAccountTarget?.name ?? "account"}?`}
        description="This will delete this account and all its transactions. If it's the last account under its institution, the institution will be removed too. This cannot be undone."
        confirmLabel="Remove"
        variant="danger"
        isLoading={removeAccountLoading}
      />
    </>
  )
}
