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

  const signOut = async (uuid?: string) => {
    try {
      await invoke("sign_out", { uuid });
      await fetchServers();
      if (ctx.alertSuccess) {
        const txt = "Signed out of " + (uuid ? findServerByUuid(servers!, uuid)?.description : "all servers");
        ctx.alertSuccess(txt);
      }
    } catch (e: unknown) {
      if (ctx.alertError) {
        ctx.alertError("Failed to sign out: " + e);
      }
    }
  };

  const signOutAll = () => {
    signOut(undefined);
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
          text="Sign Out All"
          tooltip="Sign out of all game servers"
          variant="danger"
          onClick={() => {
            if (ctx.showConfirmationModal) {
              ctx.showConfirmationModal(
                "Are you sure you want to sign out of all game servers?",
                "Sign Out All",
                "danger",
                signOutAll
              );
            }
          }}
        />
      </Stack>
      <AuthenticationList servers={servers} signOut={signOut} />
    </>
  );
}
