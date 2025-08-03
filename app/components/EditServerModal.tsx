import { useState, useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Tabs from "react-bootstrap/Tabs";
import Tab from "react-bootstrap/Tab";

import Button from "./Button";

import { ServerEntry, VersionEntry, NewServerDetails } from "@/app/types";
import { useT } from "@/app/i18n";

const TAB_SIMPLE = "simple";
const TAB_ENDPOINT = "endpoint";

const DEFAULT_IP = "localhost";
const DEFAULT_PORT = "23000"; // used only for placeholder text; backend adds port if not present

const validateHostname = (hostname: string) => {
  const hostnameTrimmed = hostname.trim();
  if (hostnameTrimmed == "") {
    return false;
  }
  const re = /^[a-z0-9.-]+$/;
  return re.test(hostnameTrimmed);
};

const validatePort = (port: string) => {
  const port_trimmed = port.trim();
  if (port_trimmed == "") {
    return false;
  }
  const portNum = parseInt(port_trimmed);
  if (isNaN(portNum)) {
    return false;
  }
  if (portNum < 1 || portNum > 65535) {
    return false;
  }
  return true;
};

const validateAddress = (address: string) => {
  const addressTrimmed = address.trim();
  if (addressTrimmed == "") {
    return true; // fine; we have a default
  }

  // check for port colon
  const colon_index = addressTrimmed.indexOf(":");
  if (colon_index == -1) {
    return validateHostname(addressTrimmed);
  } else {
    const hostname = addressTrimmed.substring(0, colon_index);
    const port = addressTrimmed.substring(colon_index + 1);
    return validateHostname(hostname) && validatePort(port);
  }
};

const validateEndpoint = (endpoint: string) => {
  const endpointTrimmed = endpoint.trim();
  if (endpointTrimmed == "") {
    return false;
  }

  // check for slash
  const slash_index = endpointTrimmed.indexOf("/");
  if (slash_index == -1) {
    return validateHostname(endpointTrimmed);
  } else {
    const hostname = endpointTrimmed.substring(0, slash_index);
    const path = endpointTrimmed.substring(slash_index);
    return validateHostname(hostname) && path != "" && !path.endsWith("/");
  }
};

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
  const t = useT();

  const doHide = () => {
    setShow(false);
  };

  const getDefaultVersion = () => {
    if (versions.length > 0) {
      return versions[0].uuid;
    }
    return "";
  };

  const [description, setDescription] = useState<string>("");
  const [tab, setTab] = useState<string>(TAB_SIMPLE);

  const [ip, setIp] = useState<string>("");
  const [version, setVersion] = useState<string>("");

  const [endpoint, setEndpoint] = useState<string>("");

  useEffect(() => {
    setDescription(server?.description || "");
    setTab(server?.endpoint ? TAB_ENDPOINT : TAB_SIMPLE);
    setIp(server?.ip || "");
    setVersion(server?.version ?? getDefaultVersion());
    setEndpoint(server?.endpoint || "");
  }, [server, versions]);

  const makeNewServerDetails = () => {
    const descTrimmed = description.trim();
    const endpointTrimmed = endpoint.trim();
    const ipTrimmed = ip.trim();

    const desc = descTrimmed == "" ? t("My OpenFusion Server") : descTrimmed;
    const newServerDetails =
      tab == TAB_ENDPOINT
        ? {
            description: desc,
            endpoint: endpointTrimmed,
            ip: undefined,
            version: undefined,
          }
        : {
            description: desc,
            endpoint: undefined,
            ip: ipTrimmed == "" ? DEFAULT_IP : ipTrimmed,
            version: version,
          };
    return newServerDetails;
  };

  return (
    <Modal show={show} onHide={() => doHide()} centered={true}>
      <Modal.Header>
        <Modal.Title>
          {t(isAdd ? "common.addServer" : "common.editServer")}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="px-0">
        <Form>
          <Form.Group className="mb-4 px-3" controlId="editServerDescription">
            <Form.Label>{t("Server Name")}</Form.Label>
            <Form.Control
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("My OpenFusion Server")}
            />
          </Form.Group>
          <Tabs
            activeKey={tab}
            onSelect={(k) => setTab(k ?? TAB_SIMPLE)}
            className="mb-3"
            fill
          >
            <Tab eventKey={TAB_SIMPLE} title={t("Simple Server")}>
              <Form.Group className="mb-3 px-3" controlId="editServerIp">
                <Form.Label>{t("Server Host")}</Form.Label>
                <Form.Control
                  type="text"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder={DEFAULT_IP + ":" + DEFAULT_PORT}
                  isInvalid={!validateAddress(ip)}
                />
              </Form.Group>
              <Form.Group className="mb-3 px-3" controlId="editServerVersion">
                <Form.Label>{t("Server Version")}</Form.Label>
                <Form.Select
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  isInvalid={version == ""}
                >
                  {versions
                    .filter((version) => !version.hidden)
                    .map((version) => (
                      <option key={version.uuid} value={version.uuid}>
                        {version.name || version.uuid}
                      </option>
                    ))}
                </Form.Select>
              </Form.Group>
            </Tab>
            <Tab eventKey={TAB_ENDPOINT} title={t("Endpoint Server")}>
              <Form.Group className="mb-3 px-3" controlId="editServerEndpoint">
                <Form.Label>{t("API Host")}</Form.Label>
                <Form.Control
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder={t("api.myserver.xyz")}
                  isInvalid={endpoint.length > 0 && !validateEndpoint(endpoint)}
                />
              </Form.Group>
            </Tab>
          </Tabs>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={() => doHide()} variant="primary" text="Cancel" />
        <Button
          onClick={() => {
            const newServerDetails = makeNewServerDetails();
            saveServer(newServerDetails, server?.uuid);
            doHide();
          }}
          variant="success"
          text={isAdd ? "Add" : "Save"}
          enabled={(() => {
            if (tab == TAB_SIMPLE) {
              return validateAddress(ip) && version != "";
            }
            if (tab == TAB_ENDPOINT) {
              return validateEndpoint(endpoint);
            }
            return false;
          })()}
        />
      </Modal.Footer>
    </Modal>
  );
}
