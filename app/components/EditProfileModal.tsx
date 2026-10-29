import { useState, useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";

import Button from "./Button";

import { LaunchProfile } from "@/app/types";
import { OPENFUSION_DISCORD_URL } from "@/app/constants";

import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

const DEFAULT_NAME = "New Profile";
const DEFAULT_COMMAND = "{}";

export default function EditProfileModal({
  profile,
  isAdd,
  show,
  setShow,
  saveProfile,
}: {
  profile?: LaunchProfile;
  isAdd: boolean;
  show: boolean;
  setShow: (newShow: boolean) => void;
  saveProfile: (name: string, command: string, uuid?: string) => void;
  deleteProfile?: (uuid: string) => void;
}) {
  const doHide = () => {
    setShow(false);
  };

  const [instructions, setInstructions] = useState<string | undefined>(
    undefined,
  );

  const [name, setName] = useState<string>("");
  const [command, setCommand] = useState<string>("");

  useEffect(() => {
    setName(isAdd ? "" : profile?.name || "");
    setCommand(isAdd ? "" : profile?.command || "");
  }, [profile, isAdd, show]);

  useEffect(() => {
    invoke<string>("get_launch_profile_instructions").then((i) => {
      setInstructions(i.charAt(0).toLowerCase() + i.slice(1));
    });
  }, []);

  const isValid = () => {
    const nameTrimmed = name.trim();
    const commandTrimmed = command.trim();
    if (nameTrimmed === "") {
      return false;
    }
    if (commandTrimmed === "" || !commandTrimmed.includes("{}")) {
      return false;
    }
    return true;
  };

  const isPreset = !isAdd && (profile !== undefined) && profile!.preset;

  return (
    <Modal show={show} onHide={() => doHide()} centered={true} size="lg">
      <Modal.Header>
        <Modal.Title>
          {isAdd ? "Add Launch Profile" : "Edit Launch Profile"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {isAdd && (
          <>
            <p>
              <strong>
                Only create a launch profile if you know what you are doing.
              </strong>{" "}
              If you create an incorrect launch profile,{" "}
              <strong>your game will not launch!</strong>
            </p>
            {instructions && (
              <p>
                If you need a launch profile but do not have any: {instructions}
                .
              </p>
            )}
            <p>
              Still need help? Ask in the #tech-support channel on our{" "}
              <a
                href={OPENFUSION_DISCORD_URL}
                onClick={(event) => {
                  event.preventDefault();
                  openUrl(event.currentTarget.href);
                }}
              >
                Discord server
              </a>
              .
            </p>
            <hr />
          </>
        )}
        <Form>
          <Form.Group controlId="editProfileName">
            <Form.Label>Profile Name</Form.Label>
            <Form.Control
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={DEFAULT_NAME}
              readOnly={isPreset}
              disabled={isPreset}
            />
          </Form.Group>
          {!isAdd && profile !== undefined && (
            <Form.Text className="text-muted">
              {"ID: " + profile!.uuid}
            </Form.Text>
          )}
          <Form.Group className="mt-3" controlId="editProfileCommand">
            <Form.Label>Launch Command</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={DEFAULT_COMMAND}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              isInvalid={command.trim() !== "" && !command.includes("{}")}
              readOnly={isPreset}
              disabled={isPreset}
            />
            <Form.Text className="text-muted">
              Use <code>{"{}"}</code> as a placeholder for the game executable
              and <code>{"{ENV_VAR_NAME}"}</code> to expand environment
              variables.
            </Form.Text>
          </Form.Group>
        </Form>
        {isPreset && (
          <>
            <hr />
            <p>
              This is a preset profile and cannot be edited. You may duplicate
              it and edit the duplicate.
            </p>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={() => doHide()} variant="primary" text="Cancel" />
        {!isAdd && (
          <Button
            icon="copy"
            text="Duplicate"
            onClick={() => {
              const profileToDuplicate = profile!;
              saveProfile(
                profileToDuplicate.name + " (copy)",
                profileToDuplicate.command,
              );
              doHide();
            }}
          />
        )}
        {!isPreset && (
          <Button
            onClick={() => {
              const nameTrimmed = name.trim();
              const commandTrimmed = command.trim();
              saveProfile(nameTrimmed, commandTrimmed, profile?.uuid);
              doHide();
            }}
            variant="success"
            text={isAdd ? "Add Profile" : "Save Profile"}
            enabled={isValid()}
          />
        )}
      </Modal.Footer>
    </Modal>
  );
}
