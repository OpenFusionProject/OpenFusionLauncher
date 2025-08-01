import Button from "./Button";
import { Stack, Modal } from "react-bootstrap";
import { open } from "@tauri-apps/plugin-shell";
import { useT } from "@/app/i18n";

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
  const t = useT();
  return (
    <Modal show={show} onHide={() => setShow(false)} centered={true}>
      <Modal.Header>
        <Modal.Title>{t("About {name}").replace("{name}", name)}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="font-monospace">
          {t("Version {version}").replace("{version}", version)}
        </p>
        <p>
          ©2020-2025 OpenFusion Contributors
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
          />
          <Button
            onClick={() => open("https://discord.gg/DYavckB")}
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
