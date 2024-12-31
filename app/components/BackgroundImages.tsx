import { useEffect } from "react";
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
  // Preload images
  useEffect(() => {
    servers.forEach((server) => {
      const imageUrl = getBackgroundImageUrlForServer(server);
      if (imageUrl) {
        const img = new Image();
        img.src = imageUrl;
      }
    });
  }, [servers]);

  return (
    <>
      {servers.map((server) => {
        const imageUrl = getBackgroundImageUrlForServer(server);
        const selected = server.uuid === selectedServer?.uuid;
        const className = selected ? "opacity-on" : "opacity-off";
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
