export const themeKey = "troy-theme";
export type Theme = "light" | "dark";

export const themeScript = [
  "(() => {",
  '  let preference; try { preference = localStorage.getItem("' + themeKey + '"); } catch {}',
  '  document.documentElement.dataset.theme = preference === "light" || preference === "dark" ? preference',
  '    : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";',
  "})();",
].join("\n");
