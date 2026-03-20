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

  const isCheckmate = game.isCheckmate();
  const winner = isCheckmate
    ? game.turn() === "w"
      ? "Black"
      : "White"
    : "";

  return (
    <>
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

      {isCheckmate && (
        <div className="settings-overlay">
          <div
            className="settings-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="settings-title">Checkmate</h3>

            <p className="checkmate-message">
              {winner} wins!
            </p>

            <div className="settings-actions">
              <button
                className="settings-apply-btn"
                onClick={handleNewGame}
              >
                Start New Game
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}