import ofLogoDark from "@/app/img/dark/of.png";
import ofLogoHalloween from "@/app/img/halloween/of.png";
import ofLogoLight from "@/app/img/light/of.png";

import { useEffect, useState } from "react";
import { ServerEntry } from "@/app/types";
import { getLogoImageUrlForServer } from "@/app/util";
import NextImage, { StaticImageData } from "next/image";

// Visibility is handled by the `theme` mixin in openfusion-theming.scss
const OF_LOGOS: Record<string, StaticImageData> = {
  dark: ofLogoDark,
  light: ofLogoLight,
  halloween: ofLogoHalloween,
};

export default function BackgroundImages({
  servers,
  selectedServer,
}: {
  servers: ServerEntry[];
  selectedServer?: ServerEntry;
}) {
  // map of server UUIDs to bools indicating whether the image is loaded
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  const isImageLoaded = (server: ServerEntry) => {
    return loadedImages[server.uuid] || false;
  };

  // Load images
  useEffect(() => {
    servers.forEach((server) => {
      const imageUrl = getLogoImageUrlForServer(server);
      if (imageUrl) {
        const img = new Image();
        img.onload = () => {
          setLoadedImages((prev) => ({ ...prev, [server.uuid]: true }));
        };
        img.src = imageUrl;
      }
    });
  }, [servers]);

  if (selectedServer && isImageLoaded(selectedServer)) {
    const imageUrl = getLogoImageUrlForServer(selectedServer)!;
    return (
      <div className="logo-image-container">
        <img
          src={imageUrl}
          className="logo-image"
          alt={selectedServer.description + " Logo"}
        />
      </div>
    );
  }

  return (
    <>
      {Object.entries(OF_LOGOS).map(([theme, logo]) => (
        <NextImage
          key={theme}
          className="themed-image"
          data-theme={theme}
          src={logo}
          alt="OpenFusion Logo"
          width={256}
        />
      ))}
    </>
  );
}
