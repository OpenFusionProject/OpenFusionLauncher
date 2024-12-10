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
      let nv: VersionCacheData = v;
      try {
        const gameSize: number = await invoke("get_cache_size", { uuid: v.version.uuid, offline: false });
        nv = { ...nv, gameSize };
      } catch (e) {}
      try {
        const offlineSize: number = await invoke("get_cache_size", { uuid: v.version.uuid, offline: true });
        nv = { ...nv, offlineSize };
      } catch (e) {}
      setVersionData((prev) => {
        return prev!.map((pv) => (pv.version.uuid === v.version.uuid ? nv : pv));
      });
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

  useEffect(() => {
    fetchVersions();
  }, []);

  return (
    <GameBuildsList
      versionData={versionData}
      clearGameCache={clearGameCache}
      downloadOfflineCache={downloadOfflineCache}
      repairOfflineCache={repairOfflineCache}
      deleteOfflineCache={deleteOfflineCache}
    />
  );
}
