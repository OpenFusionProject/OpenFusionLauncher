import { LauncherSettings } from "@/app/types";
import { useContext, useEffect, useState } from "react";
import { Col, Container, Form, Row } from "react-bootstrap";
import SettingControlDropdown from "./SettingControlDropdown";
import SettingControlBrowse from "./SettingControlBrowse";
import { getDebugMode } from "@/app/util";
import { SettingsCtx } from "@/app/contexts";
import SettingsHeader from "./SettingsHeader";

export default function LauncherSettingsTab({
  active,
  currentSettings,
  updateSettings,
}: {
  active: boolean;
  currentSettings: LauncherSettings;
  updateSettings: (
    newSettings: LauncherSettings | undefined,
  ) => Promise<LauncherSettings>;
}) {
  const [settings, setSettings] = useState<LauncherSettings>(currentSettings);
  const [working, setWorking] = useState<boolean>(false);

  const [debug, setDebug] = useState<boolean>(false);

  const ctx = useContext(SettingsCtx);

  useEffect(() => {
    getDebugMode().then(setDebug);
  }, [active]);

  const applySettings = async () => {
    setWorking(true);
    // The backend might adjust stuff, so update the state
    const newConfig = await updateSettings(settings!);
    setSettings(newConfig);
    setWorking(false);
  };

  const areSettingsDifferent = () => {
    const currentJson = JSON.stringify(
      currentSettings,
      Object.keys(currentSettings).sort(),
    );
    const newJson = JSON.stringify(settings, Object.keys(settings).sort());
    return currentJson !== newJson;
  };
  const canApply = areSettingsDifferent();

  const resetSettings = async () => {
    setWorking(true);
    const newConfig = await updateSettings(undefined);
    setSettings(newConfig);
    setWorking(false);
  };

  const showResetConfirmation = () => {
    if (ctx.showConfirmationModal) {
      ctx.showConfirmationModal(
        "Are you sure you want to reset the launcher settings to their defaults?",
        "Reset Launcher Settings",
        "danger",
        resetSettings,
      );
    }
  };

  return (
    <Container fluid id="settings-container" className="bg-footer">
      <Row>
        <Col />
        <Col
          xs={12}
          sm={10}
          md={8}
          id="settings-column"
          className="primary my-5 p-3 rounded border border-primary"
        >
          <SettingsHeader
            text="Launcher Settings"
            working={working}
            canApply={canApply}
            onApply={applySettings}
            onDiscard={() => setSettings(currentSettings)}
            onReset={showResetConfirmation}
          />
          <hr className="border-primary" />
          {settings && (
            <Form>
              <SettingControlDropdown
                id="theme"
                name="Launcher Theme"
                options={[
                  { key: "system", label: "Match system theme" },
                  { key: "dexlabs_dark", label: "DexLabs Dark" },
                  { key: "dexlabs_light", label: "DexLabs Light" },
                ]}
                defaultKey="system"
                oldValue={currentSettings.theme}
                value={settings.theme}
                onChange={(value) =>
                  setSettings((current) => ({
                    ...current!,
                    theme: value === "system" ? undefined : value,
                  }))
                }
              />
              <SettingControlDropdown
                id="check_for_updates"
                name="Check for launcher updates on launch"
                options={[
                  { key: "yes", value: true, label: "Yes" },
                  { key: "no", value: false, label: "No" },
                ]}
                defaultKey="yes"
                oldValue={currentSettings.check_for_updates}
                value={settings.check_for_updates}
                onChange={(value) =>
                  setSettings((current) => ({
                    ...current!,
                    check_for_updates: value,
                  }))
                }
              />
              <SettingControlDropdown
                id="use_offline_caches"
                name="Use offline caches when downloaded"
                options={[
                  { key: "yes", value: true, label: "Yes" },
                  { key: "no", value: false, label: "No" },
                ]}
                defaultKey="yes"
                oldValue={currentSettings.use_offline_caches}
                value={settings.use_offline_caches}
                onChange={(value) =>
                  setSettings((current) => ({
                    ...current!,
                    use_offline_caches: value,
                  }))
                }
              />
              <SettingControlDropdown
                id="verify_offline_caches"
                name="Verify offline caches on launch"
                options={[
                  { key: "yes", value: true, label: "Yes" },
                  { key: "no", value: false, label: "No" },
                ]}
                defaultKey="no"
                oldValue={currentSettings.verify_offline_caches}
                value={settings.verify_offline_caches}
                onChange={(value) =>
                  setSettings((current) => ({
                    ...current!,
                    verify_offline_caches: value,
                  }))
                }
              />
              <SettingControlDropdown
                id="launch_behavior"
                name="Launch behavior"
                options={[
                  {
                    key: "hide",
                    label: "Hide",
                    description:
                      "hide the launcher when the game is launched, show again after game exits",
                  },
                  {
                    key: "quit",
                    label: "Quit",
                    description: "quit the launcher when the game is launched",
                  },
                  {
                    key: "stay_open",
                    label: "Stay Open",
                    description:
                      "keep the launcher open when the game is launched",
                  },
                ]}
                defaultKey="hide"
                oldValue={currentSettings.launch_behavior}
                value={settings.launch_behavior}
                onChange={(value) =>
                  setSettings((current) => ({
                    ...current!,
                    launch_behavior: value,
                  }))
                }
              />
              <SettingControlBrowse
                id="game_cache_path"
                name="Game Cache Path"
                oldValue={currentSettings.game_cache_path}
                value={settings.game_cache_path}
                directory={true}
                onChange={(value) =>
                  setSettings((current) => ({
                    ...current!,
                    game_cache_path: value,
                  }))
                }
              />
              <SettingControlBrowse
                id="offline_cache_path"
                name="Offline Cache Path"
                oldValue={currentSettings.offline_cache_path}
                value={settings.offline_cache_path}
                directory={true}
                onChange={(value) =>
                  setSettings((current) => ({
                    ...current!,
                    offline_cache_path: value,
                  }))
                }
              />
            </Form>
          )}
          {debug && (
            <>
              <hr className="border-primary" />
              <h6>Debug</h6>
              <textarea
                className="w-100"
                rows={5}
                value={JSON.stringify(currentSettings, null, 4)}
                readOnly
              />
              <textarea
                className="w-100"
                rows={5}
                value={JSON.stringify(settings, null, 4)}
                readOnly
              />
            </>
          )}
        </Col>
        <Col />
      </Row>
    </Container>
  );
}
