import Modal from "react-bootstrap/Modal";

import Button from "./Button";

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
      <Modal.Footer>
        <Button
          onClick={() => setShow(false)}
          variant="primary"
          text="Close"
          enabled={true}
        />
      </Modal.Footer>
    </Modal>
  );
}
