import Button from "./Button";
import {
  getPlatform,
  getFFRunnerVersion,
  getWebplayerDllVersion,
} from "@/app/util";
import { useState, useEffect } from "react";
import { Stack, Modal } from "react-bootstrap";
import { openUrl } from "@tauri-apps/plugin-opener";

export default function AboutModal({
  show,
  setShow,
  name,
  version,
  collectLogs,
}: {
  show: boolean;
  setShow: (newShow: boolean) => void;
  name: string;
  version: string;
  collectLogs: () => void;
}) {
  const [platform, setPlatform] = useState<string | undefined>(undefined);
  const [webplayerDllVersion, setWebplayerDllVersion] = useState<
    string | undefined
  >(undefined);
  const [ffrunnerVersion, setFFRunnerVersion] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    getPlatform().then(setPlatform);
    getFFRunnerVersion().then(setFFRunnerVersion);
    getWebplayerDllVersion().then(setWebplayerDllVersion);
  }, []);

  return (
    <Modal show={show} onHide={() => setShow(false)} centered={true}>
      <Modal.Header>
        <Modal.Title>About {name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Version {version} {platform ? `(${platform})` : ""}
          <br />
          ffrunner Version: {ffrunnerVersion ?? "unknown"}
          <br />
          Webplayer DLL Version: {webplayerDllVersion ?? "unknown"}
        </p>
        <p>
          ©2020-2026 OpenFusion Contributors
          <br />
          OpenFusion is licensed under MIT.
          <br />
        </p>
        <hr />
        <p>
          Logs are useful for debugging issues, however note that they may
          contain sensitive information.
          <br />
          Please only share the below logs with those you trust.
        </p>
        <Button
          className="mx-1"
          onClick={collectLogs}
          variant="warning"
          icon="file-archive"
          text="Collect Diagnostic Logs"
          iconLeft
        />
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
