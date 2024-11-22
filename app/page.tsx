"use client";

import ofLogoLight from "./img/of-light.png";
import ofLogoDark from "./img/of-dark.png";

import startEasterEggs from "./easter-eggs";

import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState, useEffect } from "react";
import Image from "next/image";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Stack from "react-bootstrap/Stack";

import {
  ServerEntry,
  NewServerDetails,
  Servers,
  Alert,
  LoadingTask,
  ImportCounts,
  VersionEntry,
  Versions,
} from "./types";

import LauncherPage from "./LauncherPage";
import ServerList from "./ServerList";
import AlertList from "./AlertList";
import Button from "./Button";
import LoadingScreen from "./LoadingScreen";
import EditServerModal from "./EditServerModal";
import DeleteServerModal from "./DeleteServerModal";
import AboutModal from "./AboutModal";
import LoginModal from "./LoginModal";

const initTasks: LoadingTask[] = [
  {
    id: "initial-fetch",
  },
];

export default function Home() {
  const [launcherVersion, setLauncherVersion] = useState("0.0.0");
  const [tagline, setTagline] = useState(
    "Welcome to OpenFusion.\nSelect a server from the list below to get started."
  );

  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | undefined>();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<LoadingTask[]>(initTasks);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [showLoginModal, setShowLoginModal] = useState(false);

  const [showAboutModal, setShowAboutModal] = useState(false);

  const [showConfigPage, setShowConfigPage] = useState(false);

  const getSelectedServer = () => {
    for (const server of servers) {
      if (server.uuid == selectedServer) {
        return server;
      }
    }
    return undefined;
  };

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

  const initialFetch = async () => {
    const versionData: Versions = await invoke("get_versions");
    setVersions(versionData.versions);
    const serverData: Servers = await invoke("get_servers");
    setServers(serverData.servers);
    stopLoading("initial-fetch");
  };

  const importFromOpenFusionClient = async () => {
    startLoading("import", "Importing");
    try {
      const counts: ImportCounts = await invoke("import_from_openfusionclient");
      if (counts.server_count == 0 && counts.version_count == 0) {
        console.log("Nothing to import");
      } else {
        let text = "Imported ";
        if (counts.version_count > 0) {
          text += counts.version_count + (counts.version_count > 1 ? " versions " : " version ");
          if (counts.server_count > 0) {
            text += "and ";
          }
        }
        if (counts.server_count > 0) {
          text += counts.server_count + (counts.server_count > 1 ? " servers " : " server ");
        }
        text += "from OpenFusionClient";
        alertSuccess(text);
      }
    } catch (e: unknown) {
      alertError("Failed to import from OpenFusionClient (" + e + ")");
    }
    stopLoading("import");
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setSelectedServer(undefined);
      setShowConfigPage(false);
    }
  };

  const doInit = async () => {
    try {
      const appVersion = await getVersion();
      setLauncherVersion(appVersion);
      const firstRun: boolean = await invoke("reload_state");
      if (firstRun) {
        await importFromOpenFusionClient();
      }
      await initialFetch();
    } catch (e: unknown) {
      alertError("Error during init (" + e + ")");
    }
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

  const connectToServer = async (serverUuid: string, username?: string, password?: string) => {
    try {
      startLoading("launch");
      await invoke("prep_launch", { uuid: serverUuid, username: username, password: password });
      stopLoading("launch");
      await getCurrentWindow().hide();
      const exit_code: number = await invoke("do_launch");
      setTagline("Thanks for playing!");
      await getCurrentWindow().show();
      if (exit_code != 0) {
        alertError("Game exited with code " + exit_code);
      }
    } catch (e: unknown) {
      await getCurrentWindow().show();
      alertError("Failed to launch (" + e + ")");
    }
    stopLoading("launch");
  };

  const showLoginOrConnect = async (serverUuid: string) => {
    const server = servers.find((s) => s.uuid == serverUuid);
    if (!server) {
      alertError("Server not found");
      return;
    }

    if (server.endpoint) {
      setShowLoginModal(true);
    } else {
      await connectToServer(serverUuid);
    }
  };

  const addServer = async (details: NewServerDetails) => {
    try {
      const uuid: string = await invoke("add_server", { details: details });
      const entry: ServerEntry = { ...details, uuid };
      const newServers = [...servers, entry];
      setServers(newServers);
      setSelectedServer(uuid);
      alertSuccess("Server added");
    } catch (e: unknown) {
      alertError("Failed to add server (" + e + ")");
    }
  };

  const updateServer = async (details: NewServerDetails, uuid: string) => {
    try {
      const entry: ServerEntry = { ...details, uuid };
      await invoke("update_server", { serverEntry: entry });
      const newServers = servers.map((server) => {
        if (server.uuid == uuid) {
          return entry;
        }
        return server;
      });
      setServers(newServers);
      alertSuccess("Server updated");
    } catch (e: unknown) {
      alertError("Failed to update server (" + e + ")");
    }
  };

  const saveServer = async (details: NewServerDetails, uuid?: string) => {
    if (uuid) {
      await updateServer(details, uuid!);
    } else {
      await addServer(details);
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
              <div id="of-intro-text">
                {tagline.split("\n").map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
            </Col>
          </Row>
          <Row
            id="server-list"
            className="d-sm-flex d-xl-flex justify-content-center justify-content-sm-center justify-content-xl-center"
          >
            <Col xs={8} className="mb-2">
              <ServerList
                servers={servers}
                versions={versions}
                selectedServer={selectedServer}
                setSelectedServer={setSelectedServer}
                onConnect={(serverUuid) => {
                  setSelectedServer(serverUuid);
                  showLoginOrConnect(serverUuid);
                }}
              />
            </Col>
          </Row>
          <Row className="justify-content-center pb-4">
            <Col xs={4}>
              <Stack gap={1} direction="horizontal">
                <Button
                  onClick={() => setShowAddModal(true)}
                  enabled={true}
                  variant="success"
                  icon="plus"
                  tooltip="Add server"
                />
                <Button
                  onClick={() => setShowEditModal(true)}
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
              <Stack
                gap={1}
                direction="horizontal"
                className="flex-row-reverse"
              >
                <Button
                  onClick={() => showLoginOrConnect(selectedServer!)}
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
            onClick={() => setShowAboutModal(true)}
            enabled={true}
            variant="primary"
            icon="info-circle"
            tooltip="About OpenFusion Launcher"
          />
        </div>
        <div id="config-button-div">
          <Button
            onClick={() => setShowConfigPage(true)}
            enabled={true}
            variant="primary"
            icon="cog"
            tooltip="Edit Configuration"
          />
        </div>
        <EditServerModal
          server={undefined}
          versions={versions}
          isAdd={true}
          show={showAddModal}
          setShow={setShowAddModal}
          saveServer={saveServer}
        />
        <EditServerModal
          server={getSelectedServer()}
          versions={versions}
          isAdd={false}
          show={showEditModal}
          setShow={setShowEditModal}
          saveServer={saveServer}
        />
        <DeleteServerModal
          server={getSelectedServer()}
          show={showDeleteModal}
          setShow={setShowDeleteModal}
          deleteServer={deleteServer}
        />
        <LoginModal
          server={getSelectedServer()}
          show={showLoginModal}
          setShow={setShowLoginModal}
          onSubmit={connectToServer}
        />
        <AboutModal
          show={showAboutModal}
          setShow={setShowAboutModal}
          version={launcherVersion}
        />
      <LauncherPage show={showConfigPage} inactiveX={-1}>
        <div id="page-config">
          <div className="mx-auto text-center">hehe dong</div>
        </div>
      </LauncherPage>
    </>
  );
}
