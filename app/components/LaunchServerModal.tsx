import Modal from "react-bootstrap/Modal";

import Button from "./Button";

import { ServerEntry } from "@/app/types";

export default function LaunchServerModal({
  server,
  show,
  setShow,
  launchServer,
}: {
  server?: ServerEntry;
  show: boolean;
  setShow: (newShow: boolean) => void;
  launchServer: (uuid: string | undefined) => void;
}) {
  return (
    <Modal show={show} onHide={() => setShow(false)} centered={true}>
      <Modal.Header>
        <Modal.Title>{server?.description}</Modal.Title>
      </Modal.Header>
      <Modal.Body>This server is already in your server list.</Modal.Body>
      <Modal.Footer>
        <Button
          onClick={() => setShow(false)}
          variant="primary"
          text="Cancel"
        />
        <Button
          onClick={() => {
            setShow(false);
            launchServer(server?.uuid);
          }}
          variant="success"
          text="Launch"
        />
      </Modal.Footer>
    </Modal>
  );
}
