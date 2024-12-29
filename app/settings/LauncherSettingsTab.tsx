import { LauncherSettings } from "@/app/types";
import { useEffect, useState } from "react";
import { Col, Container, Form, Row } from "react-bootstrap";
import SettingControl from "./SettingControl";

export default function LauncherSettingsTab({
  active,
  currentSettings,
}: {
  active: boolean;
  currentSettings?: LauncherSettings;
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
          <h2>Launcher Settings</h2>
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
              value={settings?.check_for_updates}
              onChange={(value) => setSettings({ ...settings!, check_for_updates: value })}
            />
          </Form>
          <hr className="border-primary" />
          <textarea id="settings-json" className="w-100" rows={5} value={JSON.stringify(settings, null, 4)} readOnly />
        </Col>
        <Col />
      </Row>
    </Container>
  );
}
