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
              id="check_for_updates"
              name="Check for launcher updates on launch"
              options={[
                { value: false, label: "No" },
                { value: true, label: "Yes" },
              ]}
              defaultValue={true}
              modified={settings?.check_for_updates !== currentSettings?.check_for_updates}
              value={settings?.check_for_updates}
              onChange={(value) => setSettings({ ...settings!, check_for_updates: value === "true" })}
            />
          </Form>
          <hr className="border-primary" />
          <textarea id="settings-json" className="w-100" rows={5} value={JSON.stringify(currentSettings, null, 4)} readOnly />
          <textarea id="settings-json" className="w-100" rows={5} value={JSON.stringify(settings, null, 4)} readOnly />
        </Col>
        <Col />
      </Row>
    </Container>
  );
}
