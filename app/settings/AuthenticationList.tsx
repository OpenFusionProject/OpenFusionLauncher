import Button from "../components/Button";
import { LoginSession, ServerEntry } from "@/app/types";
import {
  getBackgroundImageStyle,
  getBackgroundImageUrlForServer,
  getLogoImageUrlForServer,
} from "@/app/util";
import { invoke } from "@tauri-apps/api/core";
import { CSSProperties, useEffect, useState } from "react";

function ListEntry({
  server,
  signOut,
}: {
  server: ServerEntry;
  signOut: (uuid: string) => void;
}) {
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [session, setSession] = useState<LoginSession | undefined | null>(
    undefined
  );

  useEffect(() => {
    const loadSession = async () => {
      try {
        const session: LoginSession = await invoke("get_session", {
          serverUuid: server.uuid,
        });
        setSession(session);
      } catch (e) {
        setSession(null);
      }
    };

    const logoUrl = getLogoImageUrlForServer(server);
    if (logoUrl) {
      const img = new Image();
      img.src = logoUrl;
      img.onload = () => {
        setLogo(logoUrl);
      };
    }

    loadSession();
  }, []);

  const bgUrl = getBackgroundImageUrlForServer(server);
  const rowStyle: CSSProperties = {
    ...getBackgroundImageStyle(bgUrl),
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
  return (
    <tr>
      <td colSpan={2} className="bg-blend" style={rowStyle}>
        <div className="d-flex justify-content-between align-items-center">
          <div className="font-monospace ps-3">
            {logo ? (
              <img
                src={logo}
                height={60}
                className="d-block"
                title={server.description}
              />
            ) : (
              <h3>{server.description}</h3>
            )}
            <small className="text-muted">{server.endpoint}</small>
          </div>
          {session === undefined ? (
            <span
              className="spinner-border spinner-border-lg mx-3"
              role="status"
              aria-hidden="true"
            ></span>
          ) : session === null ? (
            <div className="text-end pe-3 pb-3">
              <small className="mb-1 d-block text-muted">not signed in</small>
              <Button
                icon="sign-in-alt"
                iconLeft
                text="Sign In"
                onClick={() => {}}
                variant="success"
                tooltip="Sign in"
              />
            </div>
          ) : (
            <div className="text-end pe-3 pb-3">
              <span className="mb-1 d-block">
                <small className="text-muted">signed in as</small>
                <h4>{" " + session.username}</h4>
              </span>
              <Button
                icon="sign-out-alt"
                iconLeft
                text="Sign Out"
                onClick={() => signOut(server.uuid)}
                variant="danger"
                tooltip="Sign out"
              />
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AuthenticationList({
  servers,
  signOut,
}: {
  servers?: ServerEntry[];
  signOut: (uuid: string) => void;
}) {
  return (
    <div className="table-responsive">
      <table className="table table-striped table-hover mb-0">
        <tbody className="align-middle">
          {!servers ? (
            <tr>
              <td colSpan={3} className="text-center">
                <span
                  className="spinner-border spinner-border-sm m-2"
                  role="status"
                  aria-hidden="true"
                ></span>
              </td>
            </tr>
          ) : servers.length == 0 ? (
            <tr>
              <td colSpan={3}>No servers available.</td>
            </tr>
          ) : (
            servers.map((server: ServerEntry) => {
              return (
                server.endpoint && (
                  <ListEntry
                    key={server.uuid}
                    server={server}
                    signOut={signOut}
                  />
                )
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
