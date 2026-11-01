import { PreferencesListClient } from "@/components/panel/preferences-list";
import { PanelShell } from "@/components/panel/ui";
import { loadPreferences } from "@/lib/panel/queries";

export default async function PreferencesPage() {
  const preferences = await loadPreferences();
  const views = preferences.map((pref) => ({
    id: pref.id,
    kind: pref.kind,
    key: pref.key,
    value: pref.value,
    strength: pref.strength,
  }));

  return (
    <PanelShell active="/panel/preferences" title="Preferences">
      <PreferencesListClient initialPreferences={views} />
    </PanelShell>
  );
}
