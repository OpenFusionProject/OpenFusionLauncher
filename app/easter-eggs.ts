import Snowflakes from 'magic-snowflakes';

let snowflakes: Snowflakes;

export function startEasterEggs() {
  const today = new Date();
  const christmasBegin = new Date(today.getFullYear(), 11, 21);
  const christmasEnd = new Date(today.getFullYear(), 11, 31);

  if (today >= christmasBegin && today <= christmasEnd) {
    snowflakes = new Snowflakes({ zIndex: -100 });
    console.log("Christmas Activated.");
    snowflakes.start();
  }
}

export function stopEasterEggs() {
  if (snowflakes) {
    snowflakes.stop();
  }
}
