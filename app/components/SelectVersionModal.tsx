import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";

import Button from "./Button";

import { ServerEntry, VersionEntry } from "@/app/types";

const findVersion = (versions: VersionEntry[], uuid: string) => {
  return versions.find((version) => version.uuid == uuid);
}

const getVersionsForServer = async (server: ServerEntry) => {
  if (!server.endpoint) {
    // Not available for simple servers
    throw new Error("Server is not an endpoint server");
  }

  const versions: string[] = await invoke("get_versions_for_server", {
    uuid: server.uuid,
  });
  return versions;
};

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

  const [available, setAvailable] = useState<string[] | undefined>(undefined);
  const [selected, setSelected] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchAvailableVersions = async () => {
      try {
        const availableVersions = await getVersionsForServer(server!);
        setAvailable(availableVersions);
      } catch (e: unknown) {
        console.error("Failed to fetch available versions: " + e);
        setAvailable([]);
      }
    }

    setSelected(undefined);
    if (server) {
      fetchAvailableVersions();
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
        {available ? (
          <Form className="mt-2">
            {available.map((uuid) => {
              const version = findVersion(versions, uuid);
              return version && (
                <Form.Check
                  key={version.uuid}
                  type="radio"
                  name="version"
                  label={getLabelForVersion(version)}
                  checked={selected === version.uuid}
                  onChange={() => setSelected(version.uuid)}
                />
              );
            })}
          </Form>
        ) : (
          <div className="text-center">
            <span
              className="spinner-border spinner-border-sm"
              role="status"
              aria-hidden="true"
            ></span>
          </div>
        )}
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
          enabled={!!selected}
        />
      </Modal.Footer>
    </Modal>
  );
}
