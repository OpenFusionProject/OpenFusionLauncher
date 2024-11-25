import { useState, useEffect } from "react";

import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Tabs from "react-bootstrap/Tabs";
import Tab from "react-bootstrap/Tab";

import Button from "./Button";

import { ServerEntry } from "./types";

const TAB_LOGIN = "login";
const TAB_REGISTER = "register";

const validateUsername = (username: string) => {
  // From OpenFusion:
  // Login has to be 4 - 32 characters long and can't contain
  // special characters other than dash and underscore
  const regex = /^[a-zA-Z0-9_-]{4,32}$/;
  return regex.test(username);
}

const validatePassword = (password: string) => {
  // From OpenFusion:
  // Password has to be 8 - 32 characters long
  const regex = /^.{8,32}$/;
  return regex.test(password);
}

const validateEmail = (email: string) => {
  // normal email regex
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
}

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
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  const [tab, setTab] = useState<string>(TAB_LOGIN);

  const validateLogin = () => {
    return username.length > 0 && password.length > 0;
  }

  const validateRegister = () => {
    return (
      validateUsername(username) &&
      validatePassword(password) &&
      password === confirmPassword &&
      validateEmail(email)
    );
  }

  const clear = () => {
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setEmail("");
  };

  useEffect(() => {
    clear();
  }, [server]);

  return (
    <Modal show={show} onHide={() => setShow(false)} centered={true}>
      <Modal.Header>
        <Modal.Title>{server?.description}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Tabs
            activeKey={tab}
            onSelect={(k) => setTab(k ?? TAB_LOGIN)}
            className="mb-3"
            fill
          >
            <Tab eventKey={TAB_LOGIN} title="Log In">
              <Form.Group className="mb-3" controlId="username">
                <Form.Control
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId="password">
                <Form.Control
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Form.Group>
            </Tab>
            <Tab eventKey={TAB_REGISTER} title="Register">
              <Form.Group className="mb-3" controlId="newUsername">
                <Form.Control
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  isInvalid={username.length > 0 && !validateUsername(username)}
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId="newPassword">
                <Form.Control
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  isInvalid={password.length > 0 && !validatePassword(password)}
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId="confirmPassword">
                <Form.Control
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  isInvalid={password !== confirmPassword}
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId="email">
                <Form.Control
                  type="text"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  isInvalid={email.length > 0 && !validateEmail(email)}
                />
              </Form.Group>
            </Tab>
          </Tabs>
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
            if (tab === TAB_LOGIN) {
              onSubmit(server!.uuid!, username, password);
            } // TODO: Register
          }}
          variant="success"
          text={tab === TAB_LOGIN ? "Log In" : "Register"}
          enabled={tab === TAB_LOGIN ? validateLogin() : validateRegister()}
        />
      </Modal.Footer>
    </Modal>
  );
}
