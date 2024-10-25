"use client";

import ofLogoLight from "./img/of-light.png";
import ofLogoDark from "./img/of-dark.png";

import startEasterEggs from "./easter-eggs";

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState, useEffect } from "react";
import Image from "next/image";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Stack from "react-bootstrap/Stack";

import {
  ServerEntry,
  Servers,
  Alert,
  LoadingTask,
  ImportCounts,
} from "./types";
import ServerList from "./ServerList";
import AlertList from "./AlertList";
import Button from "./Button";
import LoadingScreen from "./LoadingScreen";
import DeleteServerModal from "./DeleteServerModal";

const initTasks: LoadingTask[] = [
  {
    id: "get-init-servers",
  },
];

export default function Home() {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | undefined>();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<LoadingTask[]>(initTasks);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const pushAlert = (variant: string, text: string) => {
    const id = Math.floor(Math.random() * 1000000);
    setAlerts((alerts) => [{ variant, text, id }, ...alerts]);
  };

  const alertError = (text: string) => {
    pushAlert("danger", text);
  };

  const alertInfo = (text: string) => {
    pushAlert("primary", text);
  };

  const alertSuccess = (text: string) => {
    pushAlert("success", text);
  };

  const startLoading = (id: string, text?: string) => {
    for (const task of loadingTasks) {
      if (task.id == id) {
        return;
      }
    }
    const newTasks = [...loadingTasks, { id, text }];
    setLoadingTasks(newTasks);
  };

  const stopLoading = (id: string) => {
    const newTasks = loadingTasks.filter((task) => task.id != id);
    setLoadingTasks(newTasks);
  };

  const updateServers = async () => {
    const serverData: Servers = await invoke("get_servers");
    setServers(serverData.servers);
    stopLoading("get-init-servers");
  };

  const importFromOpenFusionClient = async () => {
    startLoading("import");
    try {
      const counts: ImportCounts = await invoke("import_from_openfusionclient");
      if (counts.server_count == 0 && counts.version_count == 0) {
        console.log("Nothing to import");
      } else {
        let text = "Imported ";
        if (counts.version_count > 0) {
          text += counts.version_count + " versions ";
          if (counts.server_count > 0) {
            text += "and ";
          }
        }
        if (counts.server_count > 0) {
          text += counts.server_count + " servers ";
        }
        text += "from OpenFusionClient";
        alertSuccess(text);
      }
    } catch (e: unknown) {
      console.log("Failed to import (" + e + ")");
    }
    stopLoading("import");
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setSelectedServer(undefined);
    }
  };

  const doInit = async () => {
    await invoke("reload_state");
    await importFromOpenFusionClient();
    await updateServers();
    window.addEventListener("keydown", handleKeydown);
    await getCurrentWindow().show();
  };

  const doDeinit = () => {
    setServers([]);
    setSelectedServer("");
    setAlerts([]);
    setLoadingTasks(initTasks);
    window.removeEventListener("keydown", handleKeydown);
  };

  const stub = () => {
    alertInfo("hehe dong");
  };

  const connectToServer = async (serverUuid?: string) => {
    if (serverUuid) {
      try {
        await invoke("prep_launch", { uuid: serverUuid });
        await getCurrentWindow().hide();
        const exit_code = await invoke("do_launch");
        await getCurrentWindow().show();
        if (exit_code != 0) {
          alertError("Game exited with code " + exit_code);
        }
      } catch (e: unknown) {
        await getCurrentWindow().show();
        alertError("Failed to launch (" + e + ")");
      }
    }
  };

  const deleteServer = async (serverUuid?: string) => {
    if (serverUuid) {
      try {
        await invoke("delete_server", { uuid: serverUuid });
        setSelectedServer(undefined);
        for (const server of servers) {
          if (server.uuid == serverUuid) {
            const newServers = servers.filter((s) => s.uuid != serverUuid);
            setServers(newServers);
            break;
          }
        }
        alertSuccess("Server deleted");
      } catch (e: unknown) {
        alertError("Failed to delete server (" + e + ")");
      }
    }
  };

  useEffect(() => {
    console.log("init");
    doInit();
    startEasterEggs();
    return () => {
      console.log("deinit");
      doDeinit();
    };
  }, []);

  return (
    <>
      <AlertList alerts={alerts} />
      {loadingTasks.length > 0 && <LoadingScreen tasks={loadingTasks} />}
      <Container id="serverselector-container">
        <Row id="of-logoheader" className="text-center mt-3">
          <Col>
            <Image
              id="of-logo-light"
              src={ofLogoLight}
              alt="OpenFusion Logo"
              width={256}
            />
            <Image
              id="of-logo-dark"
              src={ofLogoDark}
              alt="OpenFusion Logo"
              width={256}
            />
            <p id="of-intro-text">
              Welcome to OpenFusion.
              <br />
              Select a server from the list below to get started.
            </p>
          </Col>
        </Row>
        <Row
          id="server-list"
          className="d-sm-flex d-xl-flex justify-content-center justify-content-sm-center justify-content-xl-center"
        >
          <Col xs={8} className="mb-2">
            <ServerList
              servers={servers}
              selectedServer={selectedServer}
              setSelectedServer={setSelectedServer}
              connectToServer={connectToServer}
            />
          </Col>
        </Row>
        <Row className="justify-content-center mb-4">
          <Col xs={4}>
            <Stack gap={1} direction="horizontal">
              <Button
                onClick={stub}
                enabled={true}
                variant="success"
                icon="plus"
                tooltip="Add server"
              />
              <Button
                onClick={stub}
                enabled={selectedServer ? true : false}
                variant="primary"
                icon="edit"
                tooltip="Edit server"
              />
              <Button
                onClick={() => setShowDeleteModal(true)}
                enabled={selectedServer ? true : false}
                variant="danger"
                icon="trash"
                tooltip="Delete server"
              />
            </Stack>
          </Col>
          <Col xs={4}>
            <Stack gap={1} direction="horizontal" className="flex-row-reverse">
              <Button
                onClick={() => connectToServer(selectedServer)}
                enabled={selectedServer ? true : false}
                variant="primary"
                icon="angle-double-right"
                text="Connect "
              />
              <Button
                onClick={stub}
                enabled={true}
                variant="primary"
                icon="database"
                tooltip="Edit Game Builds"
              />
            </Stack>
          </Col>
        </Row>
      </Container>
      <div id="about-button-div">
        <Button
          onClick={stub}
          enabled={true}
          variant="primary"
          icon="info-circle"
          tooltip="About OpenFusion Launcher"
        />
      </div>
      <div id="config-button-div">
        <Button
          onClick={stub}
          enabled={true}
          variant="primary"
          icon="cog"
          tooltip="Edit Configuration"
        />
      </div>
      <DeleteServerModal
        servers={servers}
        selectedServer={selectedServer}
        show={showDeleteModal}
        setShow={setShowDeleteModal}
        deleteServer={deleteServer}
      />
    </>
  );
}
