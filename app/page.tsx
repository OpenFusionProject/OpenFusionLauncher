"use client";

import { startEasterEggs } from "./easter-eggs";

import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState, useEffect, useRef } from "react";
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
  LoginSession,
  RegistrationResult,
  AlertEvent,
  Config,
  UpdateInfo,
} from "@/app/types";

import ServerList from "@/components/ServerList";
import Button from "@/components/Button";
import LoadingScreen from "@/components/LoadingScreen";
import EditServerModal from "@/components/EditServerModal";
import DeleteServerModal from "@/components/DeleteServerModal";
import AboutModal from "@/components/AboutModal";
import LoginModal from "@/components/LoginModal";
import BackgroundImages from "@/components/BackgroundImages";
import LogoImages from "@/components/LogoImages";
import SelectVersionModal from "@/components/SelectVersionModal";
import Toasts from "@/components/Toasts";
import { listen } from "@tauri-apps/api/event";
import { getDebugMode, getTheme, sleep } from "@/app/util";

const DEFAULT_TAGLINE =
  "Welcome to OpenFusion.\nSelect a server from the list below to get started.";

export default function Home() {
  const loadedRef = useRef(false);

  const [launcherVersion, setLauncherVersion] = useState("--");
  const [updateAvailable, setUpdateAvailable] = useState<
    UpdateInfo | undefined
  >(undefined);
  const [tagline, setTagline] = useState(DEFAULT_TAGLINE);

  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [config, setConfig] = useState<Config | undefined>(undefined);
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);

  const [versions, setVersions] = useState<VersionEntry[]>([]);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<LoadingTask[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showVersionSelectorModal, setShowVersionSelectorModal] =
    useState(false);

  const [showAboutModal, setShowAboutModal] = useState(false);

  const [connecting, setConnecting] = useState(false);

  const getSelectedServer = () => {
    if (selectedIdx >= 0 && selectedIdx < servers.length) {
      return servers[selectedIdx];
    }
    return undefined;
  };

  const setSelectedServer = (uuid?: string) => {
    if (uuid) {
      const idx = servers.findIndex((server) => server.uuid == uuid);
      if (idx >= 0) {
        setSelectedIdx(idx);
      }
    } else {
      setSelectedIdx(-1);
    }
  };

  const pushAlert = (variant: string, text: string, link?: string) => {
    const id = Math.floor(Math.random() * 1000000);
    setAlerts((alerts) => [{ variant, text, id, link }, ...alerts]);
  };

  const alertWarning = (text: string) => {
    pushAlert("warning", text);
  };

  const alertError = (text: string) => {
    pushAlert("danger", text);
  };

  const alertInfo = (text: string, link?: string) => {
    pushAlert("primary", text, link);
  };

  const alertSuccess = (text: string) => {
    pushAlert("success", text);
  };

  const startLoading = (id: string, text?: string) => {
    setLoadingTasks((tasks) => {
      const newTasks = tasks.filter((task) => task.id != id);
      return [...newTasks, { id, text }];
    });
  };

  const stopLoading = (id: string) => {
    setLoadingTasks((tasks) => tasks.filter((task) => task.id != id));
  };

  const syncServers = async () => {
    const serverData: Servers = await invoke("get_servers");
    setServers(serverData.servers);
  };

  const syncVersions = async () => {
    const versionData: Versions = await invoke("get_versions");
    setVersions(versionData.versions);
  };

  const syncConfig = async () => {
    const config: Config = await invoke("get_config");
    const theme = getTheme(config);
    document.documentElement.setAttribute("data-bs-theme", theme);
    setConfig(config);
    return config;
  };

  const syncServersAndVersions = async () => {
    await syncVersions();
    await syncServers();
  };

  const checkForUpdate = async () => {
    try {
      const updateInfo: UpdateInfo | undefined =
        await invoke("check_for_update");
      if (updateInfo) {
        setUpdateAvailable(updateInfo);
        alertInfo("Update available: " + updateInfo.version, updateInfo.url);
      }
    } catch (e: unknown) {
      console.warn("Failed to check for updates (" + e + ")");
    }
  };

  const initialFetch = async () => {
    const config: Config = await syncConfig();
    await syncServersAndVersions();
    if (config.launcher.check_for_updates) {
      checkForUpdate(); // no need to await
    }
    getDebugMode().then((debug) => {
      if (debug) {
        alertWarning("Debug mode enabled");
      }
    });
    setInitialFetchDone(true);
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
          text +=
            counts.version_count +
            (counts.version_count > 1 ? " versions " : " version ");
          if (counts.server_count > 0) {
            text += "and ";
          }
        }
        if (counts.server_count > 0) {
          text +=
            counts.server_count +
            (counts.server_count > 1 ? " servers " : " server ");
        }
        text += "from OpenFusionClient";
        alertSuccess(text);
      }
    } catch (e: unknown) {
      alertError("Failed to import from OpenFusionClient (" + e + ")");
    }
    stopLoading("import");
  };

  const setVersionForServer = async (
    serverUuid: string,
    versionUuid: string,
  ) => {
    const server = servers.find((s) => s.uuid == serverUuid);
    if (!server) {
      return;
    }
    const details: NewServerDetails = { ...server, version: versionUuid };
    try {
      await updateServer(details, serverUuid, false);
    } catch (e: unknown) {
      console.warn("Failed to set version for server: " + e);
    }
    onConnect(serverUuid, versionUuid);
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setSelectedServer(undefined);
    }

    // Server selector controls
    // const modulo = servers.length;
    // if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
    //   const newIdx = (selectedIdx <= 0 ? modulo - 1 : (selectedIdx - 1));
    //   setSelectedIdx(newIdx);
    // }
    // if (e.key === "ArrowDown" || e.key === "ArrowRight") {
    //   const newIdx = (selectedIdx + 1) % modulo;
    //   setSelectedIdx(newIdx);
    // }
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
      await getCurrentWindow().show();
      await getCurrentWindow().setFocus();
    } catch (e: unknown) {
      await getCurrentWindow().show();
      alertError("Error during init (" + e + ")");
    }
  };

  const connectToServer = async (
    serverUuid: string,
    versionUuid: string,
    sessionToken?: string,
  ) => {
    try {
      startLoading("launch");
      const timeout: number | undefined = await invoke("prep_launch", {
        serverUuid: serverUuid,
        versionUuid: versionUuid,
        sessionToken: sessionToken,
      });
      if (timeout) {
        await sleep(timeout * 1000);
      }
      stopLoading("launch");

      if (config!.launcher.launch_behavior == "hide") {
        await getCurrentWindow().hide();
      }
      const exitCode: number = await invoke("do_launch");
      setTagline("Thanks for playing!");
      await getCurrentWindow().show();
      if (exitCode != 0) {
        alertError("Game exited with code " + exitCode);
      }
    } catch (e: unknown) {
      await getCurrentWindow().show();
      alertError("Failed to launch (" + e + ")");
    }
    stopLoading("launch");
  };

  const onRegister = async (
    serverUuid: string,
    username: string,
    password: string,
    email: string,
  ) => {
    startLoading("do_register");
    try {
      const res: RegistrationResult = await invoke("do_register", {
        serverUuid: serverUuid,
        username: username,
        password: password,
        email: email,
      });

      if (res.can_login) {
        alertSuccess(res.resp);
        onLogin(serverUuid, username, password);
      } else {
        alertInfo(res.resp);
      }
    } catch (e: unknown) {
      alertError("Failed to register (" + e + ")");
    }
    stopLoading("do_register");
  };

  const onLogin = async (
    serverUuid: string,
    username: string,
    password: string,
  ) => {
    startLoading("do_login");
    try {
      await invoke("do_login", {
        serverUuid: serverUuid,
        username: username,
        password: password,
      });
    } catch (e: unknown) {
      alertError("Failed to login (" + e + ")");
      return;
    } finally {
      stopLoading("do_login");
    }
    onConnect(serverUuid);
  };

  const onConnect = async (serverUuid: string, versionUuid?: string) => {
    const server = servers.find((s) => s.uuid == serverUuid);
    if (!server) {
      alertError("Server not found");
      setConnecting(false);
      return;
    }

    let session: LoginSession | undefined = undefined;
    let version: string | undefined = versionUuid ?? server.version;
    if (server.endpoint) {
      startLoading("configure_endpoint");

      // authenticate before worrying about versions
      try {
        const loginSession: LoginSession = await invoke("get_session", {
          serverUuid: serverUuid,
        });
        session = loginSession;
      } catch {
        // If we can't get a session token for ANY REASON, we'll grab a new refresh token
        // by making the user log in again
        stopLoading("configure_endpoint");
        setShowLoginModal(true);
        setConnecting(false);
        return;
      }

      // check supported versions
      let versions: string[] = [];
      try {
        versions = await invoke("get_versions_for_server", {
          uuid: serverUuid,
        });
      } catch (e: unknown) {
        stopLoading("configure_endpoint");
        alertError("Failed to get versions: " + e);
        setConnecting(false);
        return;
      }

      if (!version || !versions.includes(version)) {
        if (versions.length == 1) {
          // only one version available, so just use that
          version = versions[0];
        } else {
          // mutliple available; show the selector
          stopLoading("configure_endpoint");
          setShowVersionSelectorModal(true);
          setConnecting(false);
          return;
        }
      }

      alertSuccess("Logged in as " + session.username);
    }

    if (!version) {
      alertError("No version selected");
      setConnecting(false);
      return;
    }

    setConnecting(false);
    connectToServer(serverUuid, version, session?.session_token);
    stopLoading("configure_endpoint");
  };

  const addServer = async (details: NewServerDetails) => {
    try {
      const uuid: string = await invoke("add_server", { details: details });
      setServers((servers) => {
        const newServer: ServerEntry = { ...details, uuid };
        return [...servers, newServer];
      });
      setSelectedServer(uuid);
      alertSuccess("Server added");
    } catch (e: unknown) {
      alertError("Failed to add server (" + e + ")");
    }
    stopLoading("add_server");
  };

  const updateServer = async (
    details: NewServerDetails,
    uuid: string,
    showSucc?: boolean,
  ) => {
    try {
      const entry: ServerEntry = { ...details, uuid };
      await invoke("update_server", { serverEntry: entry });
      setServers((servers) => {
        const newServers = servers.map((server) => {
          if (server.uuid == uuid) {
            return entry;
          }
          return server;
        });
        return newServers;
      });
      if (showSucc ?? true) {
        alertSuccess("Server updated");
      }
    } catch (e: unknown) {
      alertError("Failed to update server (" + e + ")");
    }
    stopLoading("update_server");
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

  const handleAlert = (alert: AlertEvent) => {
    console.log("alert", alert);
    pushAlert(alert.variant, alert.message);
  };

  useEffect(() => {
    if (!loadedRef.current) {
      console.log("init");
      doInit();
      startEasterEggs();

      listen<AlertEvent>("alert", (e) => {
        handleAlert(e.payload);
      });
      loadedRef.current = true;
    }
  }, []);

  // Keyboard event listener needs to be separate since it depends on state
  useEffect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [servers, selectedIdx]);

  return initialFetchDone ? (
    <>
      <Toasts alerts={alerts} />
      {loadingTasks.length > 0 && <LoadingScreen tasks={loadingTasks} />}
      <BackgroundImages
        servers={servers}
        selectedServer={getSelectedServer()}
      />
      <Container id="serverselector-container">
        <Row id="of-logoheader" className="text-center pt-3">
          <Col>
            <LogoImages
              servers={servers}
              selectedServer={getSelectedServer()}
            />
            <div id="of-intro-text">
              {tagline.split("\n").map((line, index) => (
                <p className="fw-bold" key={index}>
                  {line}
                </p>
              ))}
            </div>
          </Col>
        </Row>
        <Row
          id="server-list"
          className="d-sm-flex d-xl-flex justify-content-center justify-content-sm-center justify-content-xl-center"
        >
          <Col xs={8} className="mb-2 main-col">
            <ServerList
              servers={servers}
              versions={versions}
              selectedServer={getSelectedServer()?.uuid}
              setSelectedServer={setSelectedServer}
              refreshVersions={syncVersions}
              onConnect={(serverUuid) => {
                setSelectedServer(serverUuid);
                setConnecting(true);
                onConnect(serverUuid);
              }}
            />
          </Col>
        </Row>
        <Row className="justify-content-center pb-4">
          <Col xs={4} className="side-col">
            <Stack gap={1} direction="horizontal">
              <Button
                onClick={() => setShowAddModal(true)}
                variant="success"
                icon="plus"
                tooltip="Add server"
              />
              <Button
                onClick={() => setShowEditModal(true)}
                enabled={getSelectedServer() ? true : false}
                variant="primary"
                icon="edit"
                tooltip="Edit server"
              />
              <Button
                onClick={() => setShowDeleteModal(true)}
                enabled={getSelectedServer() ? true : false}
                variant="danger"
                icon="trash"
                tooltip="Delete server"
              />
            </Stack>
          </Col>
          <Col xs={4} className="side-col">
            <Stack gap={1} direction="horizontal" className="flex-row-reverse">
              <Button
                loading={connecting}
                onClick={() => {
                  setConnecting(true);
                  onConnect(getSelectedServer()!.uuid);
                }}
                enabled={getSelectedServer() ? true : false}
                variant="primary"
                icon="angle-double-right"
                text="Connect"
              />
            </Stack>
          </Col>
        </Row>
      </Container>
      <div id="about-button-div">
        <Button
          onClick={() => setShowAboutModal(true)}
          variant="primary"
          icon="info-circle"
          tooltip="About OpenFusion Launcher"
        />
      </div>
      <div id="config-button-div">
        <Button
          onClick={() => (window.location.href = "/settings")}
          variant="primary"
          icon="cog"
          tooltip="Settings"
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
        onClose={() => setShowLoginModal(false)}
        onSubmitLogin={(username, password) => {
          onLogin(getSelectedServer()!.uuid, username, password);
        }}
        onSubmitRegister={(username, password, email) => {
          onRegister(getSelectedServer()!.uuid, username, password, email);
        }}
      />
      <SelectVersionModal
        show={showVersionSelectorModal}
        setShow={setShowVersionSelectorModal}
        server={getSelectedServer()}
        versions={versions}
        onSelect={(selected) => {
          setVersionForServer(getSelectedServer()!.uuid, selected);
        }}
      />
      <AboutModal
        show={showAboutModal}
        setShow={setShowAboutModal}
        version={launcherVersion}
      />
    </>
  ) : (
    <LoadingScreen tasks={[{ id: "init" }]} />
  );
}
