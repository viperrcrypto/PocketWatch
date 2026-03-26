"use client"

import { PreferencesSection } from "@/components/settings/preferences-section"
import { PasswordChangeSection } from "@/components/settings/password-change-section"
import { PasskeySection } from "@/components/settings/passkey-section"
import { NotificationSettings } from "@/components/settings/notification-settings"
import { NotificationPreferencesSection } from "@/components/settings/notification-preferences"
import { AutoLockSetting } from "@/components/settings/auto-lock-setting"
import { BackupSection } from "@/components/settings/backup-section"
import { ClearDataSection } from "@/components/settings/clear-data-section"
import { CollapsibleSection } from "@/components/settings/collapsible-section"

export default function SystemSettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-foreground">System Settings</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Preferences, security, notifications, and data management
        </p>
      </div>

      {/* App Preferences */}
      <PreferencesSection />

      <CollapsibleSection
        title="Auto-Lock"
        subtitle="Lock the app after inactivity"
        defaultOpen
      >
        <AutoLockSetting />
      </CollapsibleSection>

      {/* Security */}
      <PasswordChangeSection />
      <PasskeySection />

      {/* Notification Channels */}
      <CollapsibleSection
        title="Notification Channels"
        subtitle="Configure how you receive push notifications"
        defaultOpen
      >
        <NotificationSettings />
      </CollapsibleSection>

      {/* Notification Routing */}
      <CollapsibleSection
        title="Notification Routing"
        subtitle="Per-channel severity, categories, and quiet hours"
      >
        <NotificationPreferencesSection />
      </CollapsibleSection>

      {/* Backup & Restore */}
      <CollapsibleSection
        title="Backup & Restore"
        subtitle="Export or import your encrypted vault"
      >
        <BackupSection />
      </CollapsibleSection>

      {/* Data Management */}
      <CollapsibleSection
        title="Data Management"
        subtitle="Clear all application data"
      >
        <ClearDataSection />
      </CollapsibleSection>
    </div>
  )
}
