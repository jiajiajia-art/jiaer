import { Component, useEffect, type ReactNode } from "react";
import { GameProvider } from "./store/GameContext";
import { useGame } from "./store/gameCtx";
import Cover from "./components/Cover";
import CharacterCreate from "./components/CharacterCreate";
import Opening from "./components/Opening";
import GameShell from "./components/GameShell";
import Ending from "./components/Ending";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="paper-grain flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <h1 className="mb-2 font-serif text-2xl font-black text-ink">出了一点小状况</h1>
          <p className="mb-5 max-w-md text-sm text-ink-soft">页面渲染时遇到错误。你的存档仍安全保存在本地，刷新即可继续。</p>
          <pre className="mb-5 max-w-md overflow-auto rounded-lg border border-line bg-paper-2 p-3 text-left text-[11px] text-danger">{String(this.state.error.message || this.state.error)}</pre>
          <button onClick={() => this.setState({ error: null })} className="rounded-xl bg-jade px-5 py-2.5 text-sm font-semibold text-paper-2 transition hover:brightness-110">
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Root() {
  const { screen, theme } = useGame();

  // 应用主题：深浅色（含 auto 跟随系统）+ 主题色
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = theme.mode === "dark" || (theme.mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", dark);
      root.classList.remove("accent-jade", "accent-plum", "accent-ink");
      root.classList.add(`accent-${theme.accent}`);
      root.classList.toggle("skin-glass", theme.skin === "glass");
      root.classList.toggle("skin-cute", theme.skin === "cute");
      root.classList.toggle("skin-dream", theme.skin === "dream");
      root.classList.toggle("skin-bloody", theme.skin === "bloody");
      root.classList.toggle("skin-pixel", theme.skin === "pixel");
      root.classList.remove("font-song", "font-round", "font-elegant", "font-brush");
      root.classList.add(`font-${theme.font ?? "song"}`);
    };
    apply();
    if (theme.mode === "auto") {
      const mq = matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  if (screen === "create") return <CharacterCreate />;
  if (screen === "opening") return <Opening />;
  if (screen === "game") return <GameShell />;
  if (screen === "ending") return <Ending />;
  return <Cover />;
}

export default function App() {
  return (
    <GameProvider>
      <ErrorBoundary>
        <Root />
      </ErrorBoundary>
    </GameProvider>
  );
}
