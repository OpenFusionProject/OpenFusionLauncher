"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Alert, LoadingTask, SettingsContext } from "@/app/types";
import { SettingsCtx } from "@/app/contexts";
import AlertList from "@/components/AlertList";
import LoadingScreen from "@/components/LoadingScreen";
import GameBuildsTab from "./GameBuildsTab";
import { Tab, Tabs } from "react-bootstrap";
import LauncherPage from "@/components/LauncherPage";
import ConfirmationModal from "../components/ConfirmationModal";

const TAB_LAUNCHER_SETTINGS = "launcher-settings";
const TAB_GAME_SETTINGS = "game-settings";
const TAB_GAME_BUILDS = "game-builds";
const TAB_AUTHENTICATION = "authentication";
const DEFAULT_TAB = TAB_LAUNCHER_SETTINGS;

export default function SettingsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<LoadingTask[]>([]);

  const [tab, setTab] = useState(DEFAULT_TAB);

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [confirmationConfirmText, setConfirmationConfirmText] = useState("");
  const [confirmationConfirmVariant, setConfirmationConfirmVariant] = useState("");
  const [confirmationOnConfirm, setConfirmationOnConfirm] = useState<() => void>(() => {});

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

  const showConfirmationModal = (message: string, confirmText: string, confirmVariant: string, onConfirm: () => void) => {
    setConfirmationMessage(message);
    setConfirmationConfirmText(confirmText);
    setConfirmationConfirmVariant(confirmVariant);
    setConfirmationOnConfirm(() => onConfirm);
    setShowConfirmation(true);
  };

  useEffect(() => {
    invoke("reload_state");
  });

  const ctx: SettingsContext = {
    alertSuccess,
    alertInfo,
    alertError,
    startLoading,
    stopLoading,
    showConfirmationModal,
  };

  return (
    <SettingsCtx.Provider value={ctx}>
      <AlertList alerts={alerts} />
      {loadingTasks.length > 0 && <LoadingScreen tasks={loadingTasks} />}
      <LauncherPage title="Settings">
        <Tabs
          activeKey={tab}
          onSelect={(k) => setTab(k ?? DEFAULT_TAB)}
          fill
        >
          <Tab
            eventKey={TAB_LAUNCHER_SETTINGS}
            title={
              <>
                <i className="fas fa-rocket"></i> <span>Launcher Settings</span>
              </>
            }
          >
            <h1>benis</h1>
          </Tab>
          <Tab
            eventKey={TAB_GAME_SETTINGS}
            title={
              <>
                <i className="fas fa-gamepad"></i> <span>Game Settings</span>
              </>
            }
          >
            <h1>benis 2</h1>
          </Tab>
          <Tab
            eventKey={TAB_GAME_BUILDS}
            title={
              <>
                <i className="fas fa-download"></i> <span>Game Builds</span>
              </>
            }
          >
            <GameBuildsTab active={tab == TAB_GAME_BUILDS} />
          </Tab>
          <Tab
            eventKey={TAB_AUTHENTICATION}
            title={
              <>
                <i className="fas fa-key"></i> <span>Authentication</span>
              </>
            }
          >
            <h1>benis 4</h1>
          </Tab>
        </Tabs>
      </LauncherPage>
      <ConfirmationModal
        show={showConfirmation}
        setShow={setShowConfirmation}
        message={confirmationMessage}
        confirmText={confirmationConfirmText}
        confirmVariant={confirmationConfirmVariant}
        onConfirm={() => {
          confirmationOnConfirm();
          setShowConfirmation(false);
        }}
      />
    </SettingsCtx.Provider>
  );
}
