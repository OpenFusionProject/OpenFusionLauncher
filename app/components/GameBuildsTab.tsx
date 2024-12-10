import { useState, useEffect, useContext } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  VersionCacheData,
  Versions,
} from "../types";
import GameBuildsList from "./GameBuildsList";
import { SettingsCtx } from "@/app/contexts";

export default function GameBuildsTab() {
  const [versionData, setVersionData] = useState<VersionCacheData[] | undefined>(undefined);

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
        const gameSize: number = await invoke("get_cache_size", { uuid: v.version.uuid, offline: false });
        setVersionData((prev) => {
          const pv = prev?.find((pv) => pv.version.uuid == v.version.uuid);
          if (pv) {
            const nv = { ...pv, gameSize };
            return prev?.map((pv) => (pv.version.uuid == v.version.uuid ? nv : pv));
          }
        });
      } catch (e) {}

      try {
        const offlineSize: number = await invoke("get_cache_size", { uuid: v.version.uuid, offline: true });
        setVersionData((prev) => {
          const pv = prev?.find((pv) => pv.version.uuid == v.version.uuid);
          if (pv) {
            const nv = { ...pv, offlineSize };
            return prev?.map((pv) => (pv.version.uuid == v.version.uuid ? nv : pv));
          }
        });
      } catch (e) {}

      updateValidity(v);
    }
  };

  const updateValidity = async (versionData: VersionCacheData) => {
    const v = versionData;
    try {
      // for some reason, cakefall chokes the game cache validation.
      // until we know why we will not run this.
      const gameCorrupted: boolean = false; //await invoke("is_cache_corrupted", { uuid: v.version.uuid, offline: false });
      setVersionData((prev) => {
        const pv = prev?.find((pv) => pv.version.uuid == v.version.uuid);
        if (pv) {
          const nv = { ...pv, gameDone: true, gameCorrupted };
          return prev?.map((pv) => (pv.version.uuid == v.version.uuid ? nv : pv));
        }
      });
    } catch (e) { console.error("Game cache validation error", v.version.uuid, e); }

    try {
      const offlineCorrupted: boolean = await invoke("is_cache_corrupted", { uuid: v.version.uuid, offline: true });
      setVersionData((prev) => {
        const pv = prev?.find((pv) => pv.version.uuid == v.version.uuid);
        if (pv) {
          const nv = { ...pv, offlineDone: true, offlineCorrupted };
          return prev?.map((pv) => (pv.version.uuid == v.version.uuid ? nv : pv));
        }
      });
    } catch (e) { console.error("Offline cache validation error", v.version.uuid, e); }
  }

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

  useEffect(() => {
    fetchVersions();
  }, []);

  return (
    <GameBuildsList
      versionData={versionData}
      clearGameCache={(uuid) => {
        if (ctx.showConfirmationModal) {
          const version = versionData!.find((v) => v.version.uuid == uuid)!;
          const label = version.version.name ?? ("version " + version.version.uuid);
          ctx.showConfirmationModal("Are you sure you want to clear the game cache for " + label + "?", "Clear", "danger", clearGameCache.bind(null, uuid));
        }
      }}
      downloadOfflineCache={downloadOfflineCache}
      repairOfflineCache={repairOfflineCache}
      deleteOfflineCache={(uuid) => {
        if (ctx.showConfirmationModal) {
          const version = versionData!.find((v) => v.version.uuid == uuid)!;
          const label = version.version.name ?? ("version " + version.version.uuid);
          ctx.showConfirmationModal("Are you sure you want to delete the offline cache for " + label + "?", "Delete", "danger", deleteOfflineCache.bind(null, uuid));
        }
      }}
    />
  );
}
