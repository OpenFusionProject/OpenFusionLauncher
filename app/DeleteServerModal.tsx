import Modal from "react-bootstrap/Modal";

import Button from "./Button";

import { ServerEntry } from "./types";

export default function DeleteServerModal({
  server,
  show,
  setShow,
  deleteServer,
}: {
  server?: ServerEntry;
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
        Do you really want to delete {server?.description}?
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
            deleteServer(server?.uuid);
          }}
          variant="danger"
          text="Yes, Delete"
          enabled={true}
        />
      </Modal.Footer>
    </Modal>
  );
}
