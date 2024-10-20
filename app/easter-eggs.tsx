import Snowflakes from 'magic-snowflakes';

export default function startEasterEggs() {
  const today = new Date();
  const christmasBegin = new Date(today.getFullYear(), 11, 21);
  const christmasEnd = new Date(today.getFullYear(), 11, 31);

  if (today >= christmasBegin && today <= christmasEnd) {
    const snowflakes = new Snowflakes({ zIndex: -100 });
    console.log("Christmas Activated.");
    snowflakes.start();
  }
}
