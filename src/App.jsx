import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import ChessBoardPanel from "./components/ChessBoardPanel";
import ControlPanel from "./components/ControlPanel";
import AnalysisPanel from "./components/AnalysisPanel";

const DIFFICULTY_DEPTH = {
  easy: 3,
  medium: 8,
  hard: 15,
};

function parseInfoLine(line) {
  if (!line.startsWith("info") || !line.includes(" pv ")) return null;

  const pvIndex = line.indexOf(" pv ");
  const header = line.slice(0, pvIndex);
  const pv = line
    .slice(pvIndex + 4)
    .trim()
    .split(" ")
    .filter(Boolean);

  const multipvMatch = header.match(/ multipv (\d+)/);
  const cpMatch = header.match(/ score cp (-?\d+)/);
  const mateMatch = header.match(/ score mate (-?\d+)/);

  return {
    multipv: multipvMatch ? Number(multipvMatch[1]) : 1,
    scoreType: mateMatch ? "mate" : "cp",
    score: mateMatch ? Number(mateMatch[1]) : cpMatch ? Number(cpMatch[1]) : 0,
    pv,
  };
}

function uciToMoveObject(uciMove) {
  if (!uciMove || uciMove.length < 4) return null;

  return {
    from: uciMove.slice(0, 2),
    to: uciMove.slice(2, 4),
    promotion: uciMove.length > 4 ? uciMove[4] : "q",
  };
}

function uciToSan(fen, uciMove) {
  if (!uciMove) return "...";

  const tempGame = new Chess(fen);
  const moveObject = uciToMoveObject(uciMove);

  if (!moveObject) return uciMove;

  const result = tempGame.move(moveObject);
  return result ? result.san : uciMove;
}

function scoreToWhiteValue(scoreType, score, sideToMove) {
  let rawValue = 0;

  if (scoreType === "mate") {
    const direction = score > 0 ? 1 : -1;
    rawValue = direction * (100000 - Math.min(Math.abs(score), 100) * 1000);
  } else {
    rawValue = score;
  }

  return sideToMove === "w" ? rawValue : -rawValue;
}

function lineToWhiteValue(line, sideToMove) {
  if (!line) return 0;
  return scoreToWhiteValue(line.scoreType, line.score, sideToMove);
}

function formatPawnLoss(cpLoss) {
  const pawns = (Math.max(0, cpLoss) / 100).toFixed(1);
  return `${pawns} pawns`;
}

function getRatingResult({
  playerUciMove,
  preLines,
  bestBeforeWhite,
  afterWhiteValue,
}) {
  const bestLine = preLines[0];
  const secondLine = preLines[1] || null;

  const bestUciMove = bestLine?.pv?.[0] || null;
  const secondBestWhite = secondLine ? lineToWhiteValue(secondLine, "w") : null;

  const evalLoss = Math.max(0, bestBeforeWhite - afterWhiteValue);
  const isBestMove = playerUciMove === bestUciMove;
  const isWinningMateLine = bestLine?.scoreType === "mate" && bestLine.score > 0;
  const standoutGap =
    secondBestWhite !== null ? bestBeforeWhite - secondBestWhite : 0;

  if (isBestMove && (isWinningMateLine || standoutGap >= 150)) {
    return {
      label: "Brilliant",
      description:
        "Brilliant. You found the engine's standout move in this position.",
      evalLoss,
      bestUciMove,
    };
  }

  if (evalLoss <= 25) {
    return {
      label: "Best Move",
      description: "Best Move. You matched the engine's top choice here.",
      evalLoss,
      bestUciMove,
    };
  }

  if (
    !isBestMove &&
    (isWinningMateLine || bestBeforeWhite >= 200) &&
    evalLoss >= 100 &&
    evalLoss <= 250 &&
    afterWhiteValue > -200
  ) {
    return {
      label: "Miss",
      description:
        "Miss. There was a stronger chance here, and this move let it slip.",
      evalLoss,
      bestUciMove,
    };
  }

  if (evalLoss <= 100) {
    return {
      label: "Good",
      description:
        "Good. This move was playable, but the engine saw something a little stronger.",
      evalLoss,
      bestUciMove,
    };
  }

  if (evalLoss <= 250) {
    return {
      label: "Mistake",
      description: `Mistake. This move gave up about ${formatPawnLoss(
        evalLoss
      )} of value.`,
      evalLoss,
      bestUciMove,
    };
  }

  return {
    label: "Blunder",
    description: `Blunder. This move dropped about ${formatPawnLoss(
      evalLoss
    )} and seriously worsened the position.`,
    evalLoss,
    bestUciMove,
  };
}

function getSuggestedMoveText({
  positionBeforeMove,
  playerUciMove,
  preLines,
  ratingLabel,
  evalLoss,
}) {
  const bestLine = preLines[0];
  const bestUciMove = bestLine?.pv?.[0];

  if (!bestUciMove) {
    return "...";
  }

  if (bestUciMove === playerUciMove) {
    return "No better move. You found the engine's top choice.";
  }

  const bestSan = uciToSan(positionBeforeMove, bestUciMove);

  if (bestLine.scoreType === "mate" && bestLine.score > 0) {
    return `${bestSan}. The engine preferred this move because it led to a winning mating attack.`;
  }

  if (ratingLabel === "Miss") {
    return `${bestSan}. The engine preferred this move because it kept a much stronger chance in the position.`;
  }

  if (ratingLabel === "Blunder") {
    return `${bestSan}. The engine preferred this move because it avoided a big drop in the position.`;
  }

  return `${bestSan}. The engine preferred this move and it kept your position about ${formatPawnLoss(
    evalLoss
  )} stronger.`;
}

export default function App() {
  const [game, setGame] = useState(new Chess());
  const [engineReady, setEngineReady] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const [lastPlayerMove, setLastPlayerMove] = useState("...");
  const [moveRatingLabel, setMoveRatingLabel] = useState("No rating yet");
  const [moveRatingDescription, setMoveRatingDescription] = useState(
    "Make a move to get feedback."
  );
  const [suggestedBetterMove, setSuggestedBetterMove] = useState("...");

  // Settings state
  const [difficulty, setDifficulty] = useState("medium");
  const [playerColor, setPlayerColor] = useState("white");
  const difficultyRef = useRef("medium");
  const playerColorRef = useRef("white");

  // Move history for undo: stores FEN snapshots before each player+computer pair
  const undoStackRef = useRef([]);

  const engineRef = useRef(null);
  const gameRef = useRef(game);

  const playerAnalysisRef = useRef({
    lines: [],
    bestWhiteValue: 0,
    fen: "",
  });

  const lastPlayerMoveMetaRef = useRef(null);

  const pendingRef = useRef({
    mode: null,
    linesByPv: {},
  });

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  function getDepth() {
    return DIFFICULTY_DEPTH[difficultyRef.current] ?? 8;
  }

  function requestEngineSearch(fen, mode) {
    if (!engineRef.current) return;

    pendingRef.current = {
      mode,
      linesByPv: {},
    };

    setIsThinking(true);
    engineRef.current.postMessage(`position fen ${fen}`);
    engineRef.current.postMessage(`go depth ${getDepth()}`);
  }

  function analyzePlayerTurn(fen) {
    requestEngineSearch(fen, "player-analysis");
  }

  function ratePlayerMove(fen) {
    requestEngineSearch(fen, "rate-player-move");
  }

  function requestComputerMove(fen) {
    requestEngineSearch(fen, "computer-move");
  }

  useEffect(() => {
    const engine = new Worker("/engine/stockfish-18-lite-single.js");
    engineRef.current = engine;

    engine.onmessage = (event) => {
      const text = event.data;
      if (typeof text !== "string") return;

      if (text === "uciok") {
        engine.postMessage("setoption name MultiPV value 3");
        engine.postMessage("isready");
        return;
      }

      if (text === "readyok") {
        setEngineReady(true);
        analyzePlayerTurn(gameRef.current.fen());
        return;
      }

      if (text.startsWith("info") && text.includes(" pv ")) {
        const parsed = parseInfoLine(text);
        if (!parsed) return;

        pendingRef.current.linesByPv[parsed.multipv] = parsed;
        return;
      }

      if (text.startsWith("bestmove")) {
        const bestMove = text.split(" ")[1];
        const lines = Object.values(pendingRef.current.linesByPv).sort(
          (a, b) => a.multipv - b.multipv
        );

        if (pendingRef.current.mode === "player-analysis") {
          playerAnalysisRef.current = {
            lines,
            bestWhiteValue: lineToWhiteValue(lines[0], "w"),
            fen: gameRef.current.fen(),
          };
          setIsThinking(false);

          // If playing as black, engine should move first at start
          if (
            playerColorRef.current === "black" &&
            gameRef.current.turn() === "w" &&
            gameRef.current.history().length === 0
          ) {
            requestComputerMove(gameRef.current.fen());
          }
          return;
        }

        if (pendingRef.current.mode === "rate-player-move") {
          const meta = lastPlayerMoveMetaRef.current;
          const afterWhiteValue = lineToWhiteValue(lines[0], "b");

          if (meta) {
            const ratingResult = getRatingResult({
              playerUciMove: meta.playerUciMove,
              preLines: meta.preLines,
              bestBeforeWhite: meta.bestBeforeWhite,
              afterWhiteValue,
            });

            setMoveRatingLabel(ratingResult.label);
            setMoveRatingDescription(ratingResult.description);
            setSuggestedBetterMove(
              getSuggestedMoveText({
                positionBeforeMove: meta.positionBeforeMove,
                playerUciMove: meta.playerUciMove,
                preLines: meta.preLines,
                ratingLabel: ratingResult.label,
                evalLoss: ratingResult.evalLoss,
              })
            );
          }

          requestComputerMove(meta.positionAfterMove);
          return;
        }

        if (pendingRef.current.mode === "computer-move") {
          const gameCopy = new Chess(gameRef.current.fen());
          const moveObject = uciToMoveObject(bestMove);

          if (moveObject) {
            const moveResult = gameCopy.move(moveObject);

            if (moveResult) {
              gameRef.current = gameCopy;
              setGame(gameCopy);
              analyzePlayerTurn(gameCopy.fen());
              return;
            }
          }

          setIsThinking(false);
        }
      }
    };

    engine.postMessage("uci");

    return () => {
      engine.terminate();
    };
  }, []);

  // Determine player's turn color
  const playerTurnColor = playerColor === "white" ? "w" : "b";

  function handlePlayerMove(sourceSquare, targetSquare) {
    if (!engineReady || isThinking) return false;
    if (game.turn() !== playerTurnColor) return false;
    if (!playerAnalysisRef.current.lines.length) return false;

    const positionBeforeMove = game.fen();
    const gameCopy = new Chess(positionBeforeMove);

    const moveResult = gameCopy.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q",
    });

    if (!moveResult) return false;

    // Save undo snapshot before this player move
    undoStackRef.current.push(positionBeforeMove);

    const playerUciMove = `${moveResult.from}${moveResult.to}${moveResult.promotion || ""
      }`;

    lastPlayerMoveMetaRef.current = {
      positionBeforeMove,
      positionAfterMove: gameCopy.fen(),
      playerUciMove,
      playerSan: moveResult.san,
      preLines: playerAnalysisRef.current.lines,
      bestBeforeWhite: playerAnalysisRef.current.bestWhiteValue,
    };

    setLastPlayerMove(moveResult.san);
    setMoveRatingLabel("Analyzing...");
    setMoveRatingDescription("Checking your move against the engine.");
    setSuggestedBetterMove("Analyzing...");

    gameRef.current = gameCopy;
    setGame(gameCopy);

    ratePlayerMove(gameCopy.fen());
    return true;
  }

  function handleUndo() {
    if (undoStackRef.current.length === 0) return;
    if (isThinking) return;

    // Pop FEN from before the last player move (before player+computer pair)
    const previousFen = undoStackRef.current.pop();

    const restoredGame = new Chess(previousFen);
    gameRef.current = restoredGame;
    setGame(restoredGame);

    setLastPlayerMove("...");
    setMoveRatingLabel("No Rating Yet");
    setMoveRatingDescription("Make a move to get feedback.");
    setSuggestedBetterMove("...");

    lastPlayerMoveMetaRef.current = null;
    playerAnalysisRef.current = { lines: [], bestWhiteValue: 0, fen: previousFen };

    if (engineReady) {
      analyzePlayerTurn(previousFen);
    }
  }

  function handleSettingsChange({ difficulty: newDiff, playerColor: newColor }) {
    setDifficulty(newDiff);
    setPlayerColor(newColor);
    difficultyRef.current = newDiff;
    playerColorRef.current = newColor;
    // Start a new game with updated settings
    startNewGame(newColor);
  }

  function startNewGame(color) {
    const newGame = new Chess();

    gameRef.current = newGame;
    setGame(newGame);
    setLastPlayerMove("...");
    setMoveRatingLabel("No Rating Yet");
    setMoveRatingDescription("Make a move to get feedback.");
    setSuggestedBetterMove("...");

    undoStackRef.current = [];

    playerAnalysisRef.current = {
      lines: [],
      bestWhiteValue: 0,
      fen: newGame.fen(),
    };

    lastPlayerMoveMetaRef.current = null;

    if (engineReady) {
      if ((color ?? playerColorRef.current) === "black") {
        // Engine plays white first
        requestEngineSearch(newGame.fen(), "computer-move");
      } else {
        analyzePlayerTurn(newGame.fen());
      }
    }
  }

  function handleNewGame() {
    startNewGame(playerColorRef.current);
  }

  const canUndo = undoStackRef.current.length > 0 && !isThinking;

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