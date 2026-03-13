import ChessBoardPanel from "./components/ChessBoardPanel";
import ControlPanel from "./components/ControlPanel";
import AnalysisPanel from "./components/AnalysisPanel";
import { useChessGame } from "./hooks/useChessGame";

export default function App() {
  const {
    game,
    difficulty,
    playerColor,
    lastPlayerMove,
    moveRatingLabel,
    moveRatingDescription,
    suggestedBetterMove,
    canUndo,
    handlePlayerMove,
    handleUndo,
    handleNewGame,
    handleSettingsChange,
  } = useChessGame();

  return (
    <div className="app-shell">
      <section className="left-column">
        <div className="controls-wrap">
          <ControlPanel
            onNewGame={handleNewGame}
            onUndo={handleUndo}
            onSettingsChange={handleSettingsChange}
            difficulty={difficulty}
            playerColor={playerColor}
            canUndo={canUndo}
          />
        </div>

        <div className="analysis-wrap">
          <AnalysisPanel
            lastPlayerMove={lastPlayerMove}
            moveRatingLabel={moveRatingLabel}
            moveRatingDescription={moveRatingDescription}
            suggestedBetterMove={suggestedBetterMove}
          />
        </div>
      </section>

      <section className="board-column">
        <ChessBoardPanel fen={game.fen()} onPieceDrop={handlePlayerMove} />
      </section>
    </div>
  );
}