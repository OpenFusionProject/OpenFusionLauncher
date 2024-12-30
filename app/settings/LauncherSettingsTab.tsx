import { LauncherSettings } from "@/app/types";
import { useEffect, useState } from "react";
import { Col, Container, Form, Row } from "react-bootstrap";
import SettingControl from "./SettingControl";
import Button from "@/components/Button";

export default function LauncherSettingsTab({
  active,
  currentSettings,
  updateSettings,
}: {
  active: boolean;
  currentSettings?: LauncherSettings;
  updateSettings: (newSettings: LauncherSettings) => void;
}) {

  const [settings, setSettings] = useState<LauncherSettings | undefined>(undefined);

  useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings);
    }
  }, [active, currentSettings]);

  return (
    <Container fluid id="settings-container" className="bg-footer">
      <Row>
        <Col />
        <Col xs={12} sm={10} md={8} id="settings-column" className="primary my-5 p-3 rounded border border-primary">
          <h2 className="d-inline-block">Launcher Settings</h2>
          <Button
            icon="trash"
            className="d-inline-block float-end ms-1"
            enabled={JSON.stringify(currentSettings) !== JSON.stringify(settings)}
            text="Discard"
            variant="danger"
            onClick={() => setSettings(currentSettings)} />
          <Button
            icon="check"
            className="d-inline-block float-end"
            enabled={JSON.stringify(currentSettings) !== JSON.stringify(settings)}
            text="Apply"
            variant="success"
            onClick={() => updateSettings(settings!)} />
          <hr className="border-primary" />
          <Form>
            <SettingControl
              id="theme"
              name="Launcher Theme"
              options={[
                { value: undefined, label: "Match system theme" },
                { value: "dexlabs_dark", label: "DexLabs Dark" },
                { value: "dexlabs_light", label: "DexLabs Light" },
              ]}
              defaultValue={undefined}
              modified={settings?.theme !== currentSettings?.theme}
              value={settings?.theme}
              onChange={(value) => setSettings({ ...settings!, theme: value })}
            />
            <SettingControl
              id="check_for_updates"
              name="Check for launcher updates on launch"
              options={[
                { value: true, label: "Yes" },
                { value: false, label: "No" },
              ]}
              defaultValue={true}
              modified={settings?.check_for_updates !== currentSettings?.check_for_updates}
              value={settings?.check_for_updates}
              onChange={(value) => setSettings({ ...settings!, check_for_updates: value === "true" })}
            />
            <SettingControl
              id="use_offline_caches"
              name="Use offline caches when downloaded"
              options={[
                { value: true, label: "Yes" },
                { value: false, label: "No" },
              ]}
              defaultValue={true}
              modified={settings?.use_offline_caches !== currentSettings?.use_offline_caches}
              value={settings?.use_offline_caches}
              onChange={(value) => setSettings({ ...settings!, use_offline_caches: value === "true" })}
            />
            <SettingControl
              id="verify_offline_caches"
              name="Verify offline caches on launch"
              options={[
                { value: true, label: "Yes" },
                { value: false, label: "No" },
              ]}
              defaultValue={false}
              modified={settings?.verify_offline_caches !== currentSettings?.verify_offline_caches}
              value={settings?.verify_offline_caches}
              onChange={(value) => setSettings({ ...settings!, verify_offline_caches: value === "true" })}
            />
            <SettingControl
              id="launch_behavior"
              name="Launch behavior"
              options={[
                { value: "hide", label: "Hide", description: "hide the launcher when the game is launched, show again after game exits" },
                { value: "quit", label: "Quit", description: "quit the launcher when the game is launched" },
                { value: "stay_open", label: "Stay Open", description: "keep the launcher open when the game is launched" },
              ]}
              defaultValue="hide"
              modified={settings?.launch_behavior !== currentSettings?.launch_behavior}
              value={settings?.launch_behavior}
              onChange={(value) => setSettings({ ...settings!, launch_behavior: value })}
            />
            <SettingControl
              id="game_cache_path"
              name="Game Cache Path"
              modified={settings?.game_cache_path !== currentSettings?.game_cache_path}
              value={settings?.game_cache_path}
              onChange={(value) => setSettings({ ...settings!, game_cache_path: value })}
            />
            <SettingControl
              id="offline_cache_path"
              name="Offline Cache Path"
              modified={settings?.offline_cache_path !== currentSettings?.offline_cache_path}
              value={settings?.offline_cache_path}
              onChange={(value) => setSettings({ ...settings!, offline_cache_path: value })}
            />
          </Form>
          {/* <hr className="border-primary" />
          <textarea id="settings-json" className="w-100" rows={5} value={JSON.stringify(currentSettings, null, 4)} readOnly />
          <textarea id="settings-json" className="w-100" rows={5} value={JSON.stringify(settings, null, 4)} readOnly /> */}
        </Col>
        <Col />
      </Row>
    </Container>
  );
}
