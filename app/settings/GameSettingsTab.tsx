import { GameSettings, WindowSize } from "@/app/types";
import { useEffect, useState } from "react";
import { Col, Container, Form, Row } from "react-bootstrap";
import Button from "@/components/Button";
import SettingControlDropdown from "./SettingControlDropdown";
import SettingControlWindowSize from "./SettingControlWindowSize";
import SettingControlText from "./SettingControlText";

export default function GameSettingsTab({
  active,
  currentSettings,
  updateSettings,
}: {
  active: boolean;
  currentSettings: GameSettings;
  updateSettings: (newSettings: GameSettings) => Promise<void>;
}) {
  const [settings, setSettings] = useState<GameSettings | undefined>(undefined);
  const [applying, setApplying] = useState<boolean>(false);

  useEffect(() => {
    if (!settings) {
      setSettings(currentSettings);
    }
  }, [active]);

  const applySettings = async () => {
    setApplying(true);
    await updateSettings(settings!);
    setApplying(false);
  };

  return (
    <Container fluid id="settings-container" className="bg-footer">
      <Row>
        <Col />
        <Col xs={12} sm={10} md={8} id="settings-column" className="primary my-5 p-3 rounded border border-primary">
          <h2 className="d-inline-block">Game Settings</h2>
          <Button
            icon="trash"
            className="d-inline-block float-end ms-1"
            enabled={JSON.stringify(currentSettings) !== JSON.stringify(settings)}
            text="Discard"
            variant="danger"
            onClick={() => setSettings(currentSettings)} />
          <Button
            loading={applying}
            icon="check"
            className="d-inline-block float-end"
            enabled={JSON.stringify(currentSettings) !== JSON.stringify(settings)}
            text="Apply"
            variant="success"
            onClick={() => applySettings()} />
          <hr className="border-primary" />
          {settings && <Form>
            <SettingControlDropdown
              id="graphics_api"
              name="Graphics API"
              options={[
                { key: "dx9", label: "DirectX 9" },
                { key: "opengl", label: "OpenGL" },
                { key: "vulkan", label: "Vulkan" },
              ]}
              defaultKey="dx9"
              oldValue={currentSettings.graphics_api}
              value={settings.graphics_api}
              onChange={(value) => setSettings({ ...settings!, graphics_api: value })}
            />
            <SettingControlText
              id="launch_command"
              name="Custom Launch Command"
              oldValue={currentSettings.launch_command}
              value={settings.launch_command}
              placeholder="{}"
              validator={(value) => value === "" || value.indexOf("{}") !== -1}
              onChange={(value) => setSettings({ ...settings!, launch_command: (value === "" ? undefined : value) })}
            />
            <SettingControlWindowSize
              id="window_size"
              name="Window Size"
              modified={settings.window_size?.width !== currentSettings?.window_size?.width || settings.window_size?.height !== currentSettings?.window_size?.height}
              value={settings?.window_size}
              onChange={(value: WindowSize | undefined) => setSettings({ ...settings!, window_size: value })}
            />
          </Form>}
          <hr className="border-primary" />
          <textarea id="settings-json" className="w-100" rows={5} value={JSON.stringify(currentSettings, null, 4)} readOnly />
          <textarea id="settings-json" className="w-100" rows={5} value={JSON.stringify(settings, null, 4)} readOnly />
        </Col>
        <Col />
      </Row>
    </Container>
  );
}
