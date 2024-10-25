import { useState, useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";

import Button from "./Button";

import { ServerEntry, VersionEntry, NewServerDetails } from "./types";

export default function EditServerModal({
  server,
  versions,
  isAdd,
  show,
  setShow,
  saveServer,
}: {
  server?: ServerEntry;
  versions: VersionEntry[];
  isAdd: boolean;
  show: boolean;
  setShow: (newShow: boolean) => void;
  saveServer: (details: NewServerDetails, uuid?: string) => void;
}) {
  const doHide = () => {
    setShow(false);
  };

  const getDefaultVersion = () => {
    if (versions.length > 0) {
      return versions[0].name;
    }
    return "";
  };

  const [description, setDescription] = useState<string>("");
  const [ip, setIp] = useState<string>("");
  const [endpoint, setEndpoint] = useState<string>("");
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    setDescription(server?.description || "");
    setIp(server?.ip || "");
    setEndpoint(server?.endpoint || "");
    setVersion(server?.version || getDefaultVersion());
  }, [server, versions]);

  return (
    <Modal show={show} onHide={() => doHide()} centered={true}>
      <Modal.Header>
        <Modal.Title>{isAdd ? "Add Server" : "Edit Server"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3" controlId="editServerDescription">
            <Form.Label>Server Description</Form.Label>
            <Form.Control
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="My OpenFusion Server"
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="editServerIp">
            <Form.Label>Server IP</Form.Label>
            <Form.Control
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="localhost:23000"
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="editServerEndpoint">
            <Form.Label>API Host (optional)</Form.Label>
            <Form.Control
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder=""
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="editServerVersion">
            <Form.Label>Server Version</Form.Label>
            <Form.Select
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            >
              {versions.map((version) => (
                <option key={version.name} value={version.name}>
                  {version.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
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
            saveServer(
              {
                description:
                  description == "" ? "My OpenFusion Server" : description,
                ip: ip == "" ? "localhost:23000" : ip,
                version: version,
                endpoint: endpoint == "" ? undefined : endpoint,
              },
              server?.uuid
            );
            doHide();
          }}
          variant="success"
          text={isAdd ? "Add" : "Save"}
          enabled={true}
        />
      </Modal.Footer>
    </Modal>
  );
}
