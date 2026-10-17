import { useEffect, useRef } from "react";
import { CompanionEngine, type CompanionState } from "../rig/engine";

interface Props {
  initialCharacter?: string;
  onReady: (engine: CompanionEngine) => void;
  onState: (s: CompanionState) => void;
  onBubble: (text: string) => void;
  onPoke: () => void;
}

/**
 * Hosts the canvas and starts the engine exactly once.
 *
 * The callbacks are held in a ref so that a parent re-render never tears the engine down
 * and rebuilds it — that would restart every animation. The effect's dependency list is
 * empty on purpose.
 */
export function Companion({ initialCharacter, onReady, onState, onBubble, onPoke }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cb = useRef({ onReady, onState, onBubble, onPoke });
  cb.current = { onReady, onState, onBubble, onPoke };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new CompanionEngine(
      canvas,
      {
        onState: (s) => cb.current.onState(s),
        onBubble: (t) => cb.current.onBubble(t),
        onPoke: () => cb.current.onPoke(),
      },
      initialCharacter,
    );
    cb.current.onReady(engine);
    void engine.start();
    return () => engine.stop();
    // Mounted once for the app's lifetime; see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="hana-canvas" />;
}
