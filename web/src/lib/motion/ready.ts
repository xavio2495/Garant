// Waits for the landing's preloader: resolves at once when there is none (other pages, repeat visits)
const wait = (name: string) =>
  new Promise<void>((resolve) => {
    if (!document.querySelector("[data-loader]")) return resolve();
    addEventListener(name, () => resolve(), { once: true });
  });

export const afterShock = () => wait("garant:shock");
export const afterLoaded = () => wait("garant:loaded");
