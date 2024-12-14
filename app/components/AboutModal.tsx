import Button from "./Button";
import { Stack, Modal } from "react-bootstrap";
import { open } from "@tauri-apps/plugin-shell";

export default function AboutModal({
  show,
  setShow,
  version,
}: {
  show: boolean;
  setShow: (newShow: boolean) => void;
  version: string;
}) {
  return (
    <Modal show={show} onHide={() => setShow(false)} centered={true}>
      <Modal.Header>
        <Modal.Title>About OpenFusion Launcher</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="font-monospace">Version {version}</p>
        <p>
          ©2020-2024 OpenFusion Contributors
          <br />
          OpenFusion is licensed under MIT.
          <br />
        </p>
      </Modal.Body>
      <Modal.Footer className="flex-row-reverse">
        <Stack direction="horizontal" gap={2} className="w-100">
          <Button
            onClick={() => open("https://github.com/OpenFusionProject/")}
            variant="primary"
            icon="github fa-brands fa-xl"
            tooltip="Github Page"
            enabled={true}
          />
          <Button
            onClick={() => open("https://discord.gg/DYavckB")}
            variant="primary"
            icon="discord fa-brands fa-lg"
            tooltip="Discord Chat"
            enabled={true}
          />
          <div className="ms-auto"></div>
          <Button
            onClick={() => setShow(false)}
            variant="primary"
            text="Close"
            enabled={true}
          />
        </Stack>
        
      </Modal.Footer>
    </Modal>
  );
}
