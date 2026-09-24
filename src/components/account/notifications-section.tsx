"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { isPushSupported, isIOS, isStandalone, notificationPermission, enablePushOnThisDevice, disablePushOnThisDevice, isThisDeviceSubscribed } from "@/lib/push-client";
import { Button } from "@/components/ui/button";

type NotifType = { id: string; label: string; description: string; enabled: boolean };

// Enable-on-this-device + per-type toggles (all on by default, see db/migrations/0010's comment)
// + a test button. The type catalog and each person's saved prefs both come from the server
// (src/app/api/me/notification-prefs/route.ts) -- this component only tracks THIS device's own
// subscription state locally (isThisDeviceSubscribed), since that's browser state the server
// can't see directly.
export function NotificationsSection() {
  const [supported, setSupported] = useState(true); // avoids a flash of "not supported" before the effect runs
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [types, setTypes] = useState<NotifType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const needsInstallFirst = isIOS() && !isStandalone();

  useEffect(() => {
    // isPushSupported() reads browser-only globals (serviceWorker/PushManager/Notification) --
    // same one-time-in-the-browser case as use-install-prompt.ts's standalone check.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(isPushSupported());
    isThisDeviceSubscribed().then(setDeviceEnabled);
    api
      .getNotificationPrefs()
      .then((res) => setTypes(res.types))
      .catch(() => {});
  }, []);

  async function handleEnable() {
    setEnabling(true);
    setError(null);
    try {
      await enablePushOnThisDevice();
      setDeviceEnabled(true);
      const res = await api.getNotificationPrefs();
      setTypes(res.types);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't enable notifications.");
    } finally {
      setEnabling(false);
    }
  }

  async function handleDisable() {
    setEnabling(true);
    setError(null);
    try {
      await disablePushOnThisDevice();
      setDeviceEnabled(false);
    } catch {
      setError("Couldn't turn off notifications on this device.");
    } finally {
      setEnabling(false);
    }
  }

  async function toggleType(id: string, on: boolean) {
    setTypes((prev) => prev && prev.map((t) => (t.id === id ? { ...t, enabled: on } : t)));
    try {
      const res = await api.setNotificationPrefs({ [id]: on });
      setTypes(res.types);
    } catch {
      // Roll back on failure -- the optimistic flip above assumed it would succeed.
      setTypes((prev) => prev && prev.map((t) => (t.id === id ? { ...t, enabled: !on } : t)));
      setError("Couldn't save that -- try again.");
    }
  }

  async function sendTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await api.sendTestPush();
      setTestResult(res.sent > 0 ? "Sent -- check this device." : "No devices reachable. Try enabling notifications again.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't send a test notification.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-[18px_20px] shadow-sm">
      <h3 className="mb-3 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Notifications</h3>

      {!supported ? (
        <p className="text-sm text-muted-foreground">This browser doesn&rsquo;t support push notifications.</p>
      ) : needsInstallFirst ? (
        <p className="text-sm text-muted-foreground">
          On iPhone, notifications only work after installing this app to your Home Screen -- see &ldquo;Install app&rdquo; below,
          then come back here.
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-3">
            {deviceEnabled ? (
              <>
                <p className="flex-1 text-sm text-good">✓ Enabled on this device</p>
                <Button variant="secondary" size="sm" disabled={enabling} onClick={handleDisable}>
                  Turn off
                </Button>
              </>
            ) : (
              <>
                <p className="flex-1 text-sm text-muted-foreground">
                  {notificationPermission() === "denied"
                    ? "Notifications are blocked for this site in your browser settings."
                    : "Not enabled on this device yet."}
                </p>
                <Button size="sm" disabled={enabling || notificationPermission() === "denied"} onClick={handleEnable}>
                  {enabling ? "Enabling…" : "Enable on this device"}
                </Button>
              </>
            )}
          </div>

          {types && (
            <div className="mb-3 flex flex-col gap-2 border-t border-border pt-3">
              {types.map((t) => (
                <label key={t.id} className="flex items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={t.enabled}
                    disabled={!deviceEnabled}
                    onChange={(e) => toggleType(t.id, e.target.checked)}
                  />
                  <span>
                    <span className="font-semibold">{t.label}</span>
                    <span className="block text-xs text-muted-foreground">{t.description}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {deviceEnabled && (
            <div className="border-t border-border pt-3">
              <Button variant="secondary" size="sm" disabled={testing} onClick={sendTest}>
                {testing ? "Sending…" : "Send test notification"}
              </Button>
              {testResult && <p className="mt-2 text-sm text-muted-foreground">{testResult}</p>}
            </div>
          )}
        </>
      )}

      {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}
