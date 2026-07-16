"use client";

import { Card, Icon, Spinner, Toggle } from "@inkd/ui/web";
import {
  NOTIFICATION_CATEGORY_META,
  type ChannelPrefs,
  type NotificationCategory,
} from "@inkd/core";
import {
  useCurrentProfile,
  useNotificationPreferences,
  useSetNotificationPreference,
} from "@inkd/core/hooks";

const CHANNELS: { key: keyof ChannelPrefs; label: string; hint: string }[] = [
  { key: "in_app", label: "In-app", hint: "The bell + notifications inbox" },
  { key: "push", label: "Push", hint: "Your mobile devices" },
  { key: "email", label: "Email", hint: "Your account email" },
];

export function NotificationPreferencesPanel() {
  const { data: profile } = useCurrentProfile();
  const userId = profile?.id;
  const prefsQ = useNotificationPreferences(userId);
  const setPref = useSetNotificationPreference(userId);

  if (prefsQ.isLoading || !userId) {
    return (
      <div className="grid min-h-[30vh] place-items-center">
        <Spinner size={24} />
      </div>
    );
  }

  const prefs = prefsQ.data ?? [];
  const byCategory = new Map(prefs.map((p) => [p.category, p]));

  function toggle(category: NotificationCategory, channel: keyof ChannelPrefs, next: boolean) {
    const current = byCategory.get(category);
    if (!current) return;
    setPref.mutate({
      category,
      channels: {
        in_app: current.in_app,
        push: current.push,
        email: current.email,
        [channel]: next,
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-xl font-bold tracking-tight">Notifications</h2>
        <p className="max-w-xl text-content-secondary">
          Choose how INKD reaches you for each kind of update. In-app always shows
          in your bell; push lands on your phone; email is best for the things you
          don&apos;t want to miss.
        </p>
      </div>

      <Card padding="none" className="overflow-hidden">
        {/* Channel legend */}
        <div className="hidden items-center gap-4 border-b border-border-subtle px-5 py-3 sm:flex">
          <span className="flex-1 text-xs font-medium uppercase tracking-[0.14em] text-content-muted">
            Event
          </span>
          {CHANNELS.map((c) => (
            <span
              key={c.key}
              className="w-16 text-center text-xs font-medium uppercase tracking-[0.14em] text-content-muted"
            >
              {c.label}
            </span>
          ))}
        </div>

        <ul className="divide-y divide-border-subtle">
          {NOTIFICATION_CATEGORY_META.map((meta) => {
            const row = byCategory.get(meta.category);
            if (!row) return null;
            return (
              <li
                key={meta.category}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium text-content-primary">
                    {meta.label}
                  </span>
                  <span className="text-xs text-content-muted">{meta.description}</span>
                </div>
                <div className="flex items-center gap-4">
                  {CHANNELS.map((c) => (
                    <div
                      key={c.key}
                      className="flex w-16 flex-col items-center gap-1"
                    >
                      <span className="text-[10px] uppercase tracking-wide text-content-muted sm:hidden">
                        {c.label}
                      </span>
                      <span className="sr-only">{`${meta.label} — ${c.label}`}</span>
                      <Toggle
                        checked={row[c.key]}
                        onCheckedChange={(v) => toggle(meta.category, c.key, v)}
                        disabled={setPref.isPending}
                      />
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="flex items-start gap-2 rounded-sm border border-border-subtle bg-surface-raised px-4 py-3">
        <Icon name="bell" size={15} className="mt-0.5 text-content-muted" />
        <p className="text-xs text-content-secondary">
          Push notifications are delivered to the INKD mobile app. Open the app and
          allow notifications to start receiving them on that device.
        </p>
      </div>
    </div>
  );
}
