"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Alert,
  Config,
  GameSettings,
  LauncherSettings,
  LoadingTask,
  SettingsContext,
} from "@/app/types";
import { SettingsCtx } from "@/app/contexts";
import Toasts from "@/components/Toasts";
import LoadingScreen from "@/components/LoadingScreen";
import GameBuildsTab from "@/app/settings/GameBuildsTab";
import { Tab, Tabs } from "react-bootstrap";
import LauncherPage from "@/components/LauncherPage";
import ConfirmationModal from "@/components/ConfirmationModal";
import { getTheme } from "@/app/util";
import AuthenticationTab from "./AuthenticationTab";
import LauncherSettingsTab from "./LauncherSettingsTab";
import GameSettingsTab from "./GameSettingsTab";
import { useT, useLanguage, type Language } from "@/app/i18n";

const TAB_LAUNCHER_SETTINGS = "launcher-settings";
const TAB_GAME_SETTINGS = "game-settings";
const TAB_GAME_BUILDS = "game-builds";
const TAB_AUTHENTICATION = "authentication";
const DEFAULT_TAB = TAB_LAUNCHER_SETTINGS;

export default function SettingsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<LoadingTask[]>([]);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  const [tab, setTab] = useState(DEFAULT_TAB);

  const t = useT();
  const { setLang } = useLanguage();

  const [config, setConfig] = useState<Config | undefined>(undefined);

  // confirmation modal
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [confirmationConfirmText, setConfirmationConfirmText] = useState("");
  const [confirmationConfirmVariant, setConfirmationConfirmVariant] =
    useState("");
  const [confirmationOnConfirm, setConfirmationOnConfirm] = useState<
    () => void
  >(() => {});

  const pushAlert = (variant: string, text: string) => {
    const id = Math.floor(Math.random() * 1000000);
    setAlerts((alerts) => [{ variant, text, id }, ...alerts]);
  };

  const alertWarning = (text: string) => {
    pushAlert("warning", text);
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

  const showConfirmationModal = (
    message: string,
    confirmText: string,
    confirmVariant: string,
    onConfirm: () => void,
  ) => {
    setConfirmationMessage(message);
    setConfirmationConfirmText(confirmText);
    setConfirmationConfirmVariant(confirmVariant);
    setConfirmationOnConfirm(() => onConfirm);
    setShowConfirmation(true);
  };

  const syncConfig = async () => {
    const config: Config = await invoke("get_config");
    const theme = getTheme(config);
    document.documentElement.setAttribute("data-bs-theme", theme);
    setConfig(config);
    setLang(config.launcher.language as Language);
    return config;
  };

  const doInit = async () => {
    try {
      await invoke("reload_state");
      await syncConfig();
      setInitialFetchDone(true);
    } catch (e) {
      alertError(
        t("Error during init: {error}", { error: String(e) }),
      );
    }
  };

  const saveConfig = async (config: Config) => {
    try {
      await invoke("update_config", { config: config });
      alertSuccess(t("Changes applied successfully"));
    } catch (e) {
      alertError(
        t("Error updating config: {error}", { error: String(e) }),
      );
    }
  };

  const resetLauncherSettings = async () => {
    try {
      await invoke("reset_launcher_config");
      alertSuccess(t("Launcher settings reset successfully"));
    } catch (e) {
      alertError(
        t("Error resetting launcher settings: {error}", {
          error: String(e),
        }),
      );
    }
  };

  const resetGameSettings = async () => {
    try {
      await invoke("reset_game_config");
      alertSuccess(t("Game settings reset successfully"));
    } catch (e) {
      alertError(
        t("Error resetting game settings: {error}", {
          error: String(e),
        }),
      );
    }
  };

  const updateLauncherSettings = async (newSettings?: LauncherSettings) => {
    if (newSettings) {
      const newConfig = { ...config!, launcher: newSettings };
      await saveConfig(newConfig);
    } else {
      await resetLauncherSettings();
    }
    const updatedConfig = await syncConfig();
    return updatedConfig.launcher;
  };

  const updateGameSettings = async (newSettings?: GameSettings) => {
    if (newSettings) {
      const newConfig = { ...config!, game: newSettings };
      await saveConfig(newConfig);
    } else {
      await resetGameSettings();
    }
    const updatedConfig = await syncConfig();
    return updatedConfig.game;
  };

  useEffect(() => {
    doInit();
  }, []);

  const ctx: SettingsContext = {
    alertSuccess,
    alertInfo,
    alertError,
    alertWarning,
    startLoading,
    stopLoading,
    showConfirmationModal,
  };

  return initialFetchDone ? (
    <SettingsCtx.Provider value={ctx}>
      <Toasts alerts={alerts} />
      {loadingTasks.length > 0 && <LoadingScreen tasks={loadingTasks} />}
      <LauncherPage title={t("Settings")} id="launcher-page-settings">
        <Tabs activeKey={tab} onSelect={(k) => setTab(k ?? DEFAULT_TAB)} fill>
          <Tab
            eventKey={TAB_LAUNCHER_SETTINGS}
            title={
              <>
                <i className="fas fa-rocket"></i> <span>{t("Launcher Settings")}</span>
              </>
            }
          >
            {config && (
              <LauncherSettingsTab
                active={tab == TAB_LAUNCHER_SETTINGS}
                currentSettings={config.launcher}
                updateSettings={updateLauncherSettings}
              />
            )}
          </Tab>
          <Tab
            eventKey={TAB_GAME_SETTINGS}
            title={
              <>
                <i className="fas fa-gamepad"></i> <span>{t("Game Settings")}</span>
              </>
            }
          >
            {config && (
              <GameSettingsTab
                active={tab == TAB_GAME_SETTINGS}
                currentSettings={config.game}
                updateSettings={updateGameSettings}
              />
            )}
          </Tab>
          <Tab
            eventKey={TAB_GAME_BUILDS}
            title={
              <>
                <i className="fas fa-download"></i> <span>{t("Game Builds")}</span>
              </>
            }
          >
            <GameBuildsTab active={tab == TAB_GAME_BUILDS} />
          </Tab>
          <Tab
            eventKey={TAB_AUTHENTICATION}
            title={
              <>
                <i className="fas fa-key"></i> <span>{t("Authentication")}</span>
              </>
            }
          >
            <AuthenticationTab active={tab == TAB_AUTHENTICATION} />
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
  ) : (
    <LoadingScreen tasks={[{ id: "init" }]} />
  );
}
