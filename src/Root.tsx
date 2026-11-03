import { useEffect, useState } from "react";
import App from "./App";
import Landing from "./Landing";
import { SHARE_PARAM } from "./mapState";

type Route = "landing" | "editor";

// Редактор живёт на #editor: так не нужна настройка сервера, а share-ссылки ?map=… по-прежнему открывают карту сразу.
function readRoute(): Route {
  if (window.location.hash === "#editor") return "editor";
  return new URLSearchParams(window.location.search).has(SHARE_PARAM) ? "editor" : "landing";
}

export default function Root() {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  useEffect(() => {
    if (route === "landing") document.title = "Urban Blueprint — редактор схемы города";
    window.scrollTo(0, 0);
  }, [route]);

  const navigate = (next: Route) => {
    window.history.pushState(null, "", next === "editor" ? `${window.location.pathname}#editor` : window.location.pathname);
    setRoute(next);
  };

  return route === "editor" ? <App onHome={() => navigate("landing")} /> : <Landing onOpenEditor={() => navigate("editor")} />;
}
