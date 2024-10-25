import Modal from "react-bootstrap/Modal";

import Button from "./Button";

import { ServerEntry } from "./types";

const getServerName = (
  servers: ServerEntry[],
  selectedServer: string | undefined
) => {
  for (const server of servers) {
    if (server.uuid == selectedServer) {
      return '"' + server.description + '"';
    }
  }
  // should never happen
  return "this server";
};

export default function DeleteServerModal({
  servers,
  selectedServer,
  show,
  setShow,
  deleteServer,
}: {
  servers: ServerEntry[];
  selectedServer: string | undefined;
  show: boolean;
  setShow: (newShow: boolean) => void;
  deleteServer: (uuid: string | undefined) => void;
}) {
  return (
    <Modal show={show} onHide={() => setShow(false)} centered={true}>
      <Modal.Header>
        <Modal.Title>Are you sure?</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Do you really want to delete {getServerName(servers, selectedServer)}?
        <br />
        <br />
        You could always re-add it later.
      </Modal.Body>
      <Modal.Footer>
        <Button
          onClick={() => setShow(false)}
          variant="primary"
          text="Cancel"
          enabled={true}
        />
        <Button
          onClick={() => {
            setShow(false);
            deleteServer(selectedServer);
          }}
          variant="danger"
          text="Yes, Delete"
          enabled={true}
        />
      </Modal.Footer>
    </Modal>
  );
}
