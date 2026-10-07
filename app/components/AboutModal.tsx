import Button from "./Button";
import { Stack, Modal } from "react-bootstrap";
import { openUrl } from "@tauri-apps/plugin-opener";

export default function AboutModal({
  show,
  setShow,
  name,
  version,
}: {
  show: boolean;
  setShow: (newShow: boolean) => void;
  name: string;
  version: string;
}) {
  return (
    <Modal show={show} onHide={() => setShow(false)} centered={true}>
      <Modal.Header>
        <Modal.Title>About {name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="font-monospace">Version {version}</p>
        <p>
          ©2020-2026 OpenFusion Contributors
          <br />
          OpenFusion is licensed under MIT.
          <br />
        </p>
      </Modal.Body>
      <Modal.Footer className="flex-row-reverse">
        <Stack direction="horizontal" gap={2} className="w-100">
          <Button
            onClick={() => openUrl("https://github.com/OpenFusionProject/")}
            variant="primary"
            icon="github fa-brands fa-xl"
            tooltip="Github Page"
          />
          <Button
            onClick={() => openUrl("https://discord.gg/DYavckB")}
            variant="primary"
            icon="discord fa-brands fa-lg"
            tooltip="Discord Chat"
          />
          <div className="ms-auto"></div>
          <Button
            onClick={() => setShow(false)}
            variant="primary"
            text="Close"
          />
        </Stack>
      </Modal.Footer>
    </Modal>
  );
}
