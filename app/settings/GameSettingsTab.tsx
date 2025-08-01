import { GameSettings, WindowSize } from "@/app/types";
import { useContext, useEffect, useState } from "react";
import { Col, Container, Form, Row } from "react-bootstrap";
import SettingControlDropdown from "./SettingControlDropdown";
import SettingControlWindowSize from "./SettingControlWindowSize";
import SettingControlText from "./SettingControlText";
import { deepEqual, getDebugMode } from "@/app/util";
import SettingsHeader from "./SettingsHeader";
import { SettingsCtx } from "@/app/contexts";
import SettingControlFpsFix from "./SettingControlFpsFix";
import { useT } from "@/app/i18n";

export default function GameSettingsTab({
  active,
  currentSettings,
  updateSettings,
}: {
  active: boolean;
  currentSettings: GameSettings;
  updateSettings: (
    newSettings: GameSettings | undefined,
  ) => Promise<GameSettings>;
}) {
  const [settings, setSettings] = useState<GameSettings>(currentSettings);
  const [working, setWorking] = useState<boolean>(false);

  const [debug, setDebug] = useState<boolean>(false);

  const ctx = useContext(SettingsCtx);
  const t = useT();

  useEffect(() => {
    getDebugMode().then(setDebug);
  }, [active]);

  const applySettings = async () => {
    setWorking(true);
    // The backend might adjust stuff, so update the state
    const newSettings = await updateSettings(settings!);
    setSettings(newSettings);
    setWorking(false);
  };

  const areSettingsDifferent = () => {
    return !deepEqual(currentSettings, settings);
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
        t("Are you sure you want to reset the game settings to their defaults?"),
        t("Reset Game Settings"),
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
            text={t("Game Settings")}
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
                id="graphics_api"
                name={t("Graphics API")}
                options={[
                  { key: "dx9", label: t("DirectX 9") },
                  { key: "vulkan", label: t("Vulkan (experimental)") },
                  { key: "opengl", label: t("OpenGL (not recommended)") },
                ]}
                defaultKey="dx9"
                oldValue={currentSettings.graphics_api}
                value={settings.graphics_api}
                onChange={(value) =>
                  setSettings({ ...settings!, graphics_api: value })
                }
              />
              <SettingControlText
                id="launch_command"
                name={t("Custom Launch Command")}
                oldValue={currentSettings.launch_command}
                value={settings.launch_command}
                placeholder="{}"
                validator={(value) =>
                  value === "" || value.indexOf("{}") !== -1
                }
                onChange={(value) =>
                  setSettings({
                    ...settings!,
                    launch_command: value === "" ? undefined : value,
                  })
                }
              />
              <SettingControlWindowSize
                id="window_size"
                name={t("Window Size")}
                modified={
                  settings.window_size?.width !==
                    currentSettings?.window_size?.width ||
                  settings.window_size?.height !==
                    currentSettings?.window_size?.height
                }
                value={settings?.window_size}
                onChange={(value: WindowSize | undefined) =>
                  setSettings({ ...settings!, window_size: value })
                }
              />
              <SettingControlFpsFix
                id="fps_fix"
                name={t("FPS Fix")}
                oldValue={currentSettings.fps_fix}
                value={settings.fps_fix}
                onChange={(value) =>
                  setSettings({ ...settings!, fps_fix: value })
                }
              />
            </Form>
          )}
          {debug && (
            <>
              <hr className="border-primary" />
              <h6>{t("Debug")}</h6>
              <textarea
                id="settings-json"
                className="w-100"
                rows={5}
                value={JSON.stringify(currentSettings, null, 4)}
                readOnly
              />
              <textarea
                id="settings-json"
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
