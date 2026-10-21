import Snowflakes from "magic-snowflakes";
import { StaticImageData } from "next/image";

import cornerTop1 from "@/app/img/halloween/CornerTop_1.png";
import cornerTop2 from "@/app/img/halloween/CornerTop_2.png";
import cornerTop3 from "@/app/img/halloween/CornerTop_3.png";
import cornerBottom1 from "@/app/img/halloween/CornerBottom_1.png";
import cornerBottom2 from "@/app/img/halloween/CornerBottom_2.png";
import cornerBottom3 from "@/app/img/halloween/CornerBottom_3.png";

const CORNER_TOP_IMAGES = [cornerTop1, cornerTop2, cornerTop3];
const CORNER_BOTTOM_IMAGES = [cornerBottom1, cornerBottom2, cornerBottom3];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

const SPIDERWEB_ATTR = "data-spiderweb";

class Spiderwebs {
  private zIndex: number;
  private opacity: number;
  private elements: HTMLImageElement[] = [];

  constructor({
    zIndex = -1,
    opacity = 0.5,
  }: { zIndex?: number; opacity?: number } = {}) {
    this.zIndex = zIndex;
    this.opacity = opacity;
  }

  start() {
    if (this.elements.length > 0) {
      return;
    }
    // Clear webs left behind by other instances (e.g. after a hot reload
    // reset module state) so corners never get stacked duplicates.
    document
      .querySelectorAll(`img[${SPIDERWEB_ATTR}]`)
      .forEach((el) => el.remove());
    this.elements = [
      this.createWeb(pickRandom(CORNER_TOP_IMAGES), "top", "left"),
      this.createWeb(pickRandom(CORNER_BOTTOM_IMAGES), "bottom", "right"),
    ];
    this.elements.forEach((el) => document.body.appendChild(el));
  }

  stop() {
    this.elements.forEach((el) => el.remove());
    this.elements = [];
  }

  // The source images are full 1920x1080 frames with the web drawn in one
  // corner, so we span the viewport width and anchor to that corner to keep
  // the web visible regardless of window aspect ratio.
  private createWeb(
    image: StaticImageData,
    vertical: "top" | "bottom",
    horizontal: "left" | "right",
  ): HTMLImageElement {
    const img = document.createElement("img");
    img.src = image.src;
    img.alt = "";
    img.draggable = false;
    img.setAttribute("aria-hidden", "true");
    img.setAttribute(SPIDERWEB_ATTR, "");
    Object.assign(img.style, {
      position: "fixed",
      [vertical]: "0",
      [horizontal]: "0",
      width: "100vw",
      height: "auto",
      zIndex: String(this.zIndex),
      opacity: String(this.opacity),
      pointerEvents: "none",
      userSelect: "none",
    });
    return img;
  }
}

let spiderwebs: Spiderwebs;
let snowflakes: Snowflakes;

const today = new Date();

export function isHalloween() {
  const begin = new Date(today.getFullYear(), 9, 20); // October 20th
  const end = new Date(today.getFullYear(), 10, 1); // November 1st
  return today >= begin && today <= end;
}

export function isChristmas() {
  const begin = new Date(today.getFullYear(), 11, 21); // December 21st
  const end = new Date(today.getFullYear(), 11, 31); // December 31st
  return today >= begin && today <= end;
}

export function startEasterEggs() {
  if (isHalloween()) {
    spiderwebs?.stop();
    spiderwebs = new Spiderwebs({ zIndex: -100 });
    console.log("Halloween Activated.");
    spiderwebs.start();
  }

  if (isChristmas()) {
    snowflakes?.stop();
    snowflakes = new Snowflakes({ zIndex: -100 });
    console.log("Christmas Activated.");
    snowflakes.start();
  }
}

export function stopEasterEggs() {
  if (spiderwebs) {
    spiderwebs.stop();
  }

  if (snowflakes) {
    snowflakes.stop();
  }
}
