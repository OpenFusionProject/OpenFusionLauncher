import { useState, useEffect, useContext } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SettingsCtx } from "@/app/contexts";
import { Stack } from "react-bootstrap";
import Button from "@/components/Button";
import { ServerEntry, Servers } from "@/app/types";
import AuthenticationList from "./AuthenticationList";

const findServerByUuid = (servers: ServerEntry[], uuid: string) => {
  return servers.find((server) => server.uuid == uuid);
};

export default function AuthenticationTab({
  active,
} : {
  active: boolean;
}) {
  const [servers, setServers] = useState<ServerEntry[] | undefined>(undefined);

  const ctx = useContext(SettingsCtx);

  const fetchServers = async () => {
    const servers: Servers = await invoke("get_servers");
    setServers(servers.servers);
  };

  const logOut = async (uuid?: string) => {
    try {
      await invoke("log_out", { uuid });
      await fetchServers();
      if (ctx.alertSuccess) {
        const txt = "Loged out of " + (uuid ? findServerByUuid(servers!, uuid)?.description : "all servers");
        ctx.alertSuccess(txt);
      }
    } catch (e: unknown) {
      if (ctx.alertError) {
        ctx.alertError("Failed to log out: " + e);
      }
    }
  };

  const logOutAll = () => {
    logOut(undefined);
  };

  useEffect(() => {
    fetchServers();
  }, [active]);

  return (
    <>
      <Stack direction="horizontal" className="flex-row-reverse p-2" gap={2} id="game-builds-buttonstack">
        <Button
          icon="sign-out-alt"
          iconLeft
          text="Log Out All"
          tooltip="Log out of all game servers"
          variant="danger"
          onClick={() => {
            if (ctx.showConfirmationModal) {
              ctx.showConfirmationModal(
                "Are you sure you want to log out of all game servers?",
                "Log Out All",
                "danger",
                logOutAll
              );
            }
          }}
        />
      </Stack>
      <AuthenticationList servers={servers} logOut={logOut} />
    </>
  );
}
