import { useState, useEffect } from "react";

import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";

import Button from "./Button";

import { ServerEntry } from "./types";

export default function LoginModal({
  server,
  show,
  setShow,
  onSubmit,
}: {
  server?: ServerEntry;
  show: boolean;
  setShow: (newShow: boolean) => void;
  onSubmit: (serverUuid: string, username?: string, password?: string) => void;
}) {

  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  useEffect(() => {
    setUsername("");
    setPassword("");
  }, [server]);

  return (
    <Modal show={show} onHide={() => setShow(false)} centered={true}>
      <Modal.Header>
        <Modal.Title>Log In</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Control
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <br />
          <Form.Control
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Form>
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
            onSubmit(server!.uuid!, username, password);
          }}
          variant="success"
          text="Log In"
          enabled={username.length > 0 && password.length > 0}
        />
      </Modal.Footer>
    </Modal>
  );
}
