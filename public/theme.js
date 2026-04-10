// Handles the dark mode toggle. The initial class is set inline in each
// page's <head> so there's no flash before this script runs.

function initTheme() {
  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;

  toggle.checked = document.documentElement.classList.contains("dark-mode");

  toggle.addEventListener("change", () => {
    if (toggle.checked) {
      document.documentElement.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
  });
}

// Kept as initSettings for backwards compatibility with old pages.
function initSettings() { initTheme(); }

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTheme);
} else {
  initTheme();
}

export { initTheme, initSettings };