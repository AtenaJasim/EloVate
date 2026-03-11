import { useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

export default function ChessBoardPanel({ fen, onPieceDrop }) {
    const [selectedSquare, setSelectedSquare] = useState(null);
    const [optionSquares, setOptionSquares] = useState({});

    function handleSquareClick(squareData) {
        const square = typeof squareData === "string" ? squareData : squareData?.square;

        if (!square) return;

        const game = new Chess(fen);
        const moves = game.moves({ square, verbose: true });

        if (moves.length === 0) {
            setSelectedSquare(null);
            setOptionSquares({});
            return;
        }

        setSelectedSquare(square);
        setOptionSquares(
            Object.fromEntries(
                moves.map((m) => [
                    m.to,
                    {
                        background: game.get(m.to)
                            ? "radial-gradient(circle, rgba(0,0,0,0.3) 55%, transparent 60%)"
                            : "radial-gradient(circle, rgba(0,0,0,0.2) 25%, transparent 30%)",
                        borderRadius: "50%",
                    },
                ])
            )
        );
    }

    function handlePieceDrop({ sourceSquare, targetSquare }) {
        setSelectedSquare(null);
        setOptionSquares({});
        return onPieceDrop(sourceSquare, targetSquare);
    }

    const squareStyles = {
        ...(selectedSquare && {
            [selectedSquare]: { background: "rgba(255, 102, 196, 0.5)" },
        }),
        ...optionSquares,
    };

    return (
        <div className="board-shell">
            <Chessboard
                options={{
                    position: fen,
                    onPieceDrop: handlePieceDrop,
                    onSquareClick: handleSquareClick,
                    customSquareStyles: squareStyles,
                    squareStyles: squareStyles,
                    lightSquareStyle: { backgroundColor: "#f5ead7" },
                    darkSquareStyle: { backgroundColor: "#8b6b52" },
                    boardStyle: {
                        borderRadius: "22px",
                        boxShadow: "0 18px 40px rgba(0, 0, 0, 0.35)",
                    },
                }}
            />
        </div>
    );
}