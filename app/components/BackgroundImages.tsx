import { useEffect, useState } from "react";
import { ServerEntry } from "@/app/types";
import {
  getBackgroundImageStyle,
  getBackgroundImageUrlForServer,
} from "@/app/util";

export default function BackgroundImages({
  servers,
  selectedServer,
}: {
  servers: ServerEntry[];
  selectedServer?: ServerEntry;
}) {
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    servers.forEach((server) => {
      if (!loaded[server.uuid]) {
        const imageUrl = getBackgroundImageUrlForServer(server);
        if (imageUrl) {
          const img = new Image();
          img.src = imageUrl;
          img.onload = () => {
            setLoaded((loaded) => ({ ...loaded, [server.uuid]: true }));
          };
          img.onerror = () => {
            setLoaded((loaded) => ({ ...loaded, [server.uuid]: false }));
          };
        }
      }
    });
  }, [servers]);

  return (
    <>
      {servers.map((server) => {
        const imageUrl = getBackgroundImageUrlForServer(server);
        const selected = server.uuid === selectedServer?.uuid;
        const className =
          selected && loaded[server.uuid] ? "opacity-on" : "opacity-off";
        const style = getBackgroundImageStyle(imageUrl);
        return (
          <div
            key={server.uuid}
            className={"background-image " + className}
            style={style}
          />
        );
      })}
    </>
  );
}
