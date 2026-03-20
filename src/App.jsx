import ChessBoardPanel from "./components/ChessBoardPanel";
import ControlPanel from "./components/ControlPanel";
import AnalysisPanel from "./components/AnalysisPanel";
import { useChessGame } from "./hooks/useChessGame";

function getGameResult(game) {
  if (game.isCheckmate()) {
    return {
      title: "Checkmate",
      detail: `${game.turn() === "w" ? "Black" : "White"} wins!`,
    };
  }

  if (game.isStalemate()) {
    return {
      title: "Stalemate",
      detail: "Tie",
    };
  }

  if (game.isInsufficientMaterial()) {
    return {
      title: "Draw",
      detail: "Tie",
    };
  }

  if (game.isThreefoldRepetition()) {
    return {
      title: "Draw",
      detail: "Tie",
    };
  }

  if (game.isDraw()) {
    return {
      title: "Draw",
      detail: "Tie",
    };
  }

  return null;
}

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

  const gameResult = getGameResult(game);

  return (
    <>
      {gameResult && (
        <div className="settings-overlay">
          <div
            className="settings-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="settings-title">{gameResult.title}</h3>
            <p className="checkmate-message">{gameResult.detail}</p>
            <button className="settings-apply-btn" onClick={handleNewGame}>
              Start New Game
            </button>
          </div>
        </div>
      )}

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
    </>
  );
}