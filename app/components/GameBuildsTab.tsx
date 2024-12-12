import { useState, useEffect, useContext } from "react";
import { invoke } from "@tauri-apps/api/core";
import { VersionCacheData, VersionCacheProgress, Versions } from "../types";
import GameBuildsList from "./GameBuildsList";
import { SettingsCtx } from "@/app/contexts";
import { listen } from "@tauri-apps/api/event";

export default function GameBuildsTab() {
  const [versionData, setVersionData] = useState<
    VersionCacheData[] | undefined
  >(undefined);

  const ctx = useContext(SettingsCtx);

  const fetchVersions = async () => {
    const versions: Versions = await invoke("get_versions");
    const data: VersionCacheData[] = versions.versions.map((version) => {
      const data: VersionCacheData = {
        version: version,
        gameDone: false,
        gameCorrupted: false,
        offlineDone: false,
        offlineCorrupted: false,
      };
      return data;
    });
    setVersionData(data);
    updateSizes(data);
  };

  const updateSizes = async (versionData: VersionCacheData[]) => {
    for (const v of versionData) {
      try {
        const gameSize: number = await invoke("get_cache_size", {
          uuid: v.version.uuid,
          offline: false,
        });
        setVersionData((prev) => {
          const pv = prev?.find((pv) => pv.version.uuid == v.version.uuid);
          if (pv) {
            const nv = { ...pv, gameSize };
            invoke("validate_cache", {
              uuid: v.version.uuid,
              offline: false,
            });
            return prev?.map((pv) =>
              pv.version.uuid == v.version.uuid ? nv : pv
            );
          }
        });
      } catch (e) {
        setVersionData((prev) => {
          const pv = prev?.find((pv) => pv.version.uuid == v.version.uuid);
          if (pv) {
            const nv = { ...pv, gameDone: true };
            return prev?.map((pv) =>
              pv.version.uuid == v.version.uuid ? nv : pv
            );
          }
        });
      }

      try {
        const offlineSize: number = await invoke("get_cache_size", {
          uuid: v.version.uuid,
          offline: true,
        });
        setVersionData((prev) => {
          const pv = prev?.find((pv) => pv.version.uuid == v.version.uuid);
          if (pv) {
            const nv = { ...pv, offlineSize };
            invoke("validate_cache", {
              uuid: v.version.uuid,
              offline: true,
            });
            return prev?.map((pv) =>
              pv.version.uuid == v.version.uuid ? nv : pv
            );
          }
        });
      } catch (e) {
        setVersionData((prev) => {
          const pv = prev?.find((pv) => pv.version.uuid == v.version.uuid);
          if (pv) {
            const nv = { ...pv, offlineDone: true };
            return prev?.map((pv) =>
              pv.version.uuid == v.version.uuid ? nv : pv
            );
          }
        });
      }
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

  const handleProgress = (progress: VersionCacheProgress) => {
    setVersionData((prev) => {
      const pv = prev?.find((pv) => pv.version.uuid == progress.uuid);
      if (pv) {
        const bytesProcessed = progress.bytes_processed;
        const isCorrupted = progress.is_corrupt;
        const isDone = progress.is_done;
        const nv: VersionCacheData = progress.offline
          ? {
              ...pv,
              offlineSizeValidated: bytesProcessed,
              offlineCorrupted: isCorrupted,
              offlineDone: isDone,
            }
          : {
              ...pv,
              gameSizeValidated: bytesProcessed,
              gameCorrupted: isCorrupted,
              gameDone: isDone,
            };
        return prev?.map((pv) => (pv.version.uuid == progress.uuid ? nv : pv));
      }
    });
  };

  useEffect(() => {
    const listener = listen<VersionCacheProgress>("cache_progress", (e) => {
      handleProgress(e.payload);
    });
    fetchVersions();

    return () => {
      listener.then((unlisten) => unlisten());
    };
  }, []);

  return (
    <GameBuildsList
      versionData={versionData}
      clearGameCache={(uuid) => {
        if (ctx.showConfirmationModal) {
          const version = versionData!.find((v) => v.version.uuid == uuid)!;
          const label =
            version.version.name ?? "version " + version.version.uuid;
          ctx.showConfirmationModal(
            "Are you sure you want to clear the game cache for " + label + "?",
            "Clear",
            "danger",
            clearGameCache.bind(null, uuid)
          );
        }
      }}
      downloadOfflineCache={downloadOfflineCache}
      repairOfflineCache={repairOfflineCache}
      deleteOfflineCache={(uuid) => {
        if (ctx.showConfirmationModal) {
          const version = versionData!.find((v) => v.version.uuid == uuid)!;
          const label =
            version.version.name ?? "version " + version.version.uuid;
          ctx.showConfirmationModal(
            "Are you sure you want to delete the offline cache for " +
              label +
              "?",
            "Delete",
            "danger",
            deleteOfflineCache.bind(null, uuid)
          );
        }
      }}
    />
  );
}
