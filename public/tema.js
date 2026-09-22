/* Aplica o tema guardado antes do primeiro render. Sem dependências. */
(function () {
  try {
    var t = localStorage.getItem("fluxo-tema");
    if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
})();
