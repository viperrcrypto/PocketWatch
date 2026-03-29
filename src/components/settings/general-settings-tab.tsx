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

export function GeneralSettingsTab() {
  return (
    <div className="space-y-6">
      <div id="preferences">
        <PreferencesSection />
      </div>

      <div id="auto-lock">
        <CollapsibleSection
          title="Auto-Lock"
          subtitle="Lock the app after inactivity"
          defaultOpen
        >
          <AutoLockSetting />
        </CollapsibleSection>
      </div>

      <div id="password">
        <PasswordChangeSection />
      </div>

      <div id="passkeys">
        <PasskeySection />
      </div>

      <div id="notification-channels">
        <CollapsibleSection
          title="Notification Channels"
          subtitle="Configure how you receive push notifications"
          defaultOpen
        >
          <NotificationSettings />
        </CollapsibleSection>
      </div>

      <div id="notification-routing">
        <CollapsibleSection
          title="Notification Routing"
          subtitle="Per-channel severity, categories, and quiet hours"
        >
          <NotificationPreferencesSection />
        </CollapsibleSection>
      </div>

      <div id="backup">
        <CollapsibleSection
          title="Backup & Restore"
          subtitle="Export or import your encrypted vault"
        >
          <BackupSection />
        </CollapsibleSection>
      </div>

      <div id="data-management">
        <CollapsibleSection
          title="Data Management"
          subtitle="Clear all application data"
        >
          <ClearDataSection />
        </CollapsibleSection>
      </div>
    </div>
  )
}
