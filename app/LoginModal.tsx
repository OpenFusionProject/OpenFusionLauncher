import { useState, useEffect, useRef } from "react";

import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Tabs from "react-bootstrap/Tabs";
import Tab from "react-bootstrap/Tab";

import Button from "./Button";

import { ServerEntry } from "./types";
import { Overlay, Tooltip } from "react-bootstrap";

const TAB_LOGIN = "login";
const TAB_REGISTER = "register";

const CONTROL_ID_USERNAME = "username";
const CONTROL_ID_PASSWORD = "password";
const CONTROL_ID_NEW_USERNAME = "newUsername";
const CONTROL_ID_NEW_PASSWORD = "newPassword";
const CONTROL_ID_CONFIRM_PASSWORD = "confirmPassword";
const CONTROL_ID_EMAIL = "email";

const validateUsername = (username: string) => {
  // From OpenFusion:
  // Login has to be 4 - 32 characters long and can't contain
  // special characters other than dash and underscore
  const regex = /^[a-zA-Z0-9_-]{4,32}$/;
  return regex.test(username);
};

const validatePassword = (password: string) => {
  // From OpenFusion:
  // Password has to be 8 - 32 characters long
  const regex = /^.{8,32}$/;
  return regex.test(password);
};

const validateEmail = (email: string) => {
  // normal email regex
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
};

function RequirementsTooltip({
  focusedControlId,
  controlId,
  children,
}: {
  focusedControlId: string | null;
  controlId: string;
  children: any;
}) {
  const target = document.getElementById(controlId);
  const show = !!(focusedControlId && focusedControlId === controlId);
  return (
    <Overlay target={target} show={show} placement="right">
      <Tooltip id={controlId + "Tooltip"}>{children}</Tooltip>
    </Overlay>
  );
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
  onSubmit: (username?: string, password?: string) => void;
}) {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  // I could not get this to work any other way; improvements welcome
  const [activeControl, setActiveControl] = useState<string | null>(null);

  const [tab, setTab] = useState<string>(TAB_LOGIN);

  const validateLogin = () => {
    return username.length > 0 && password.length > 0;
  };

  const validateRegister = () => {
    return (
      validateUsername(username) &&
      validatePassword(password) &&
      password === confirmPassword &&
      validateEmail(email)
    );
  };

  const clear = () => {
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setEmail("");
  };

  useEffect(() => {
    clear();
  }, [server]);

  const canSubmit = (tab: string) => {
    return tab === TAB_LOGIN ? validateLogin() : validateRegister();
  }

  const submitForm = () => {
    if (!canSubmit(tab)) return;
    setShow(false);
    if (tab === TAB_LOGIN) {
      onSubmit(username, password);
    } // TODO: Register
  }

  return (
    <Modal show={show} onHide={() => setShow(false)} centered={true}>
      <Form onSubmit={(e) => {
        e.preventDefault();
        submitForm();
      }}>
        <Modal.Header>
          <Modal.Title>{server?.description}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Tabs
            activeKey={tab}
            onSelect={(k) => setTab(k ?? TAB_LOGIN)}
            className="mb-3"
            fill
          >
            <Tab eventKey={TAB_LOGIN} title="Log In">
              <Form.Group className="mb-3" controlId={CONTROL_ID_USERNAME}>
                <Form.Control
                  type="text"
                  placeholder="Username"
                  value={username}
                  onFocus={() => setActiveControl(CONTROL_ID_USERNAME)}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId={CONTROL_ID_PASSWORD}>
                <Form.Control
                  type="password"
                  placeholder="Password"
                  value={password}
                  onFocus={() => setActiveControl(CONTROL_ID_PASSWORD)}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Form.Group>
            </Tab>
            <Tab eventKey={TAB_REGISTER} title="Register">
              <Form.Group className="mb-3" controlId={CONTROL_ID_NEW_USERNAME}>
                <Form.Control
                  type="text"
                  placeholder="Username"
                  value={username}
                  onFocus={() => setActiveControl(CONTROL_ID_NEW_USERNAME)}
                  onChange={(e) => setUsername(e.target.value)}
                  isInvalid={username.length > 0 && !validateUsername(username)}
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId={CONTROL_ID_NEW_PASSWORD}>
                <Form.Control
                  type="password"
                  placeholder="Password"
                  value={password}
                  onFocus={() => setActiveControl(CONTROL_ID_NEW_PASSWORD)}
                  onChange={(e) => setPassword(e.target.value)}
                  isInvalid={password.length > 0 && !validatePassword(password)}
                />
              </Form.Group>
              <Form.Group
                className="mb-3"
                controlId={CONTROL_ID_CONFIRM_PASSWORD}
              >
                <Form.Control
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onFocus={() => setActiveControl(CONTROL_ID_CONFIRM_PASSWORD)}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  isInvalid={password !== confirmPassword}
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId={CONTROL_ID_EMAIL}>
                <Form.Control
                  type="text"
                  placeholder="Email"
                  value={email}
                  onFocus={() => setActiveControl(CONTROL_ID_EMAIL)}
                  onChange={(e) => setEmail(e.target.value)}
                  isInvalid={email.length > 0 && !validateEmail(email)}
                />
              </Form.Group>
              <RequirementsTooltip
                focusedControlId={activeControl}
                controlId={CONTROL_ID_NEW_USERNAME}
              >
                <div className="text-start lh-small">
                  • 4 - 32 characters long
                  <br />• No special characters besides - and _
                </div>
              </RequirementsTooltip>
              <RequirementsTooltip
                focusedControlId={activeControl}
                controlId={CONTROL_ID_NEW_PASSWORD}
              >
                <div className="text-start lh-small">
                  • 8 - 32 characters long
                </div>
              </RequirementsTooltip>
            </Tab>
          </Tabs>
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={() => setShow(false)}
            variant="primary"
            text="Cancel"
            enabled={true}
          />
          <Button
            onClick={submitForm}
            variant="success"
            text={tab === TAB_LOGIN ? "Log In" : "Register"}
            enabled={canSubmit(tab)}
          />
          {/* Hidden submit button */}
          <button type="submit" style={{ display: "none" }} />
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
