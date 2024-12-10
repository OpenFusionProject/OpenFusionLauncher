import { useState, useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";

import Button from "./Button";

import { ServerEntry, VersionEntry } from "@/app/types";

const findVersion = (versions: VersionEntry[], uuid: string) => {
  return versions.find((version) => version.uuid == uuid);
}

const getLabelForVersion = (version: VersionEntry) => {
  if (version.name) {
    let label = "";
    label += version.name;
    if (version.description) {
      label += ": " + version.description;
    }
    return label;
  }
  return version.uuid;
}

export default function SelectVersionModal({
  server,
  versions,
  show,
  setShow,
  onSelect,
}: {
  server?: ServerEntry;
  versions: VersionEntry[];
  show: boolean;
  setShow: (newShow: boolean) => void;
  onSelect: (selectedVersionUuid: string) => void;
}) {
  const doHide = () => {
    setShow(false);
  };
  const [selected, setSelected] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (server) {
      setSelected(server.versions[0]);
    }
  }, [server]);

  return (
    <Modal show={show} onHide={() => doHide()} centered={true}>
      <Modal.Header>
        <Modal.Title>Select Game Version</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        The server <strong>{server?.description}</strong> supports multiple game versions. Please select a version to use.
        <br />
        <Form className="mt-2">
          {server?.versions?.map((version) => {
            const versionEntry = findVersion(versions, version);
            if (!versionEntry) {
              return null;
            }
            return (
              <Form.Check
                key={version}
                type="radio"
                name="version"
                label={getLabelForVersion(versionEntry)}
                checked={selected === version}
                onChange={() => setSelected(version)}
              />
            );
          })}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          onClick={() => doHide()}
          variant="primary"
          text="Cancel"
          enabled={true}
        />
        <Button
          onClick={() => {
            doHide();
            onSelect(selected!);
          }}
          variant="success"
          text="Select"
          enabled={selected !== undefined}
        />
      </Modal.Footer>
    </Modal>
  );
}
