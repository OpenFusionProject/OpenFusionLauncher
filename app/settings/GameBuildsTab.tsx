import { useState, useEffect, useContext } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  ValidationEvent,
  VersionCacheData,
  VersionEntry,
  Versions,
} from "../types";
import GameBuildsList from "../GameBuildsList";
import LauncherPage from "../LauncherPage";
import Button from "../Button";
import AlertList from "../AlertList";
import LoadingScreen from "../LoadingScreen";
import { SettingsCtx } from "../contexts";

export default function GameBuildsTab() {
  const [loaded, setLoaded] = useState<boolean>(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [versionData, setVersionData] = useState<
    Record<string, VersionCacheData>
  >({});

  const ctx = useContext(SettingsCtx);

  const kickoffVersionValidation = async (version: VersionEntry) => {
    if (version.total_uncompressed_size) {
      invoke("validate_version_game", { uuid: version.uuid })
        .then((_) => {
          setVersionData((prevVersionData) => {
            const oldData = prevVersionData[version.uuid]!;
            const newData = { ...oldData, gameDone: true };
            return {
              ...prevVersionData,
              [version.uuid]: newData,
            };
          });
        })
        .catch((e) => { console.log("error with game validation: " + e) });
    } else {
      setVersionData((prevVersionData) => {
        const oldData = prevVersionData[version.uuid] ?? {
          offlineSize: undefined,
          gameSize: undefined,
        };
        const newData = { ...oldData, gameDone: true };
        return {
          ...prevVersionData,
          [version.uuid]: newData,
        };
      });
    }

    if (version.total_compressed_size && version.main_file_info) {
      invoke("validate_version_offline", { uuid: version.uuid })
        .then((passed) => {
          setVersionData((prevVersionData) => {
            const oldData = prevVersionData[version.uuid]!;
            const newData = {
              ...oldData,
              offlineDone: true,
              offlineCorrupted: !passed,
            };
            return {
              ...prevVersionData,
              [version.uuid]: newData,
            };
          });
        })
        .catch((e) => { console.log("error with offline validation: " + e) });
    } else {
      setVersionData((prevVersionData) => {
        const oldData = prevVersionData[version.uuid] ?? {
          offlineSize: undefined,
          gameSize: undefined,
        };
        const newData = {
          ...oldData,
          offlineDone: true,
          offlineCorrupted: false,
        };
        return {
          ...prevVersionData,
          [version.uuid]: newData,
        };
      });
    }
  }

  const fetchVersions = async () => {
    const versionData: Versions = await invoke("get_versions");
    setVersions(versionData.versions);
    setLoaded(true);
    for (const version of versionData.versions) {
      kickoffVersionValidation(version);
    }
  };

  const stub = () => {
    if (ctx.alertInfo) {
      ctx.alertInfo("hehe dong");
    }
  };

  const clearGameCache = async (uuid: string) => {
    stub();
  };

  const downloadOfflineCache = async (uuid: string) => {
    stub();
  };

  const repairOfflineCache = async (uuid: string) => {
    stub();
  };

  const deleteOfflineCache = async (uuid: string) => {
    stub();
  };

  const handleValidationEvent = (e: ValidationEvent, offline: boolean) => {
    setVersionData((prevVersionData) => {
      const oldData = prevVersionData[e.uuid] ?? {
        offlineSize: undefined,
        gameSize: undefined,
      };
      const newBytes = e.sz;
      const newData = offline
        ? { ...oldData, offlineSize: newBytes }
        : { ...oldData, gameSize: newBytes };
      return {
        ...prevVersionData,
        [e.uuid]: newData,
      };
    });
  };

  const registerValidationEventListeners = () => {
    listen<ValidationEvent>("validated_item_game", (e) => {
      handleValidationEvent(e.payload, false);
    });
    listen<ValidationEvent>("validated_item_offline", (e) => {
      handleValidationEvent(e.payload, true);
    });
  };

  useEffect(() => {
    fetchVersions();
    registerValidationEventListeners();

    // Clean up
    return () => {
      setLoaded(false);
      setVersions([]);
    };
  }, []);

  return (
    <GameBuildsList
      versions={loaded ? versions : undefined}
      versionData={versionData}
      clearGameCache={clearGameCache}
      downloadOfflineCache={downloadOfflineCache}
      repairOfflineCache={repairOfflineCache}
      deleteOfflineCache={deleteOfflineCache}
    />
  );
}
