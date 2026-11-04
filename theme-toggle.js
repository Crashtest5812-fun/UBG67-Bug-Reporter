(() => {
  const button = document.querySelector(".theme-toggle");
  if (!button) return;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  let savedTheme;
  try {
    savedTheme = localStorage.getItem("ubg67-theme");
  } catch (error) {
    console.warn("Could not read the saved theme preference.", error);
  }

  const setTheme = (theme, save = false) => {
    const isDark = theme === "dark";
    document.body.dataset.theme = isDark ? "dark" : "light";
    button.textContent = isDark ? "Light mode" : "Dark mode";
    button.setAttribute("aria-pressed", String(isDark));
    if (themeColor) themeColor.content = isDark ? "#141b1a" : "#f5f5f5";

    if (save) {
      try {
        localStorage.setItem("ubg67-theme", theme);
      } catch (error) {
        console.warn("Could not save the theme preference.", error);
      }
    }
  };

  const initialTheme = savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(initialTheme);

  button.addEventListener("click", () => {
    setTheme(document.body.dataset.theme === "dark" ? "light" : "dark", true);
  });
})();
