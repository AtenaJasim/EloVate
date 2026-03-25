import { useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import PawnPromotionModal from "./PawnPromotionModal";

export default function ChessBoardPanel({ fen, onPieceDrop }) {
    const [selectedSquare, setSelectedSquare] = useState(null);
    const [optionSquares, setOptionSquares] = useState({});
    const [pendingPromotion, setPendingPromotion] = useState(null);

    function getMovesFrom(square) {
        const game = new Chess(fen);
        return game.moves({ square, verbose: true });
    }

    function isPromotionMove(sourceSquare, targetSquare) {
        const moves = getMovesFrom(sourceSquare);
        return moves.some((m) => m.to === targetSquare && m.promotion);
    }

    function handleSquareClick(squareData) {
        const square =
            typeof squareData === "string" ? squareData : squareData?.square;
        if (!square) return;

        // If a square is already selected, try to move to the clicked square
        if (selectedSquare) {
            const moves = getMovesFrom(selectedSquare);
            const targetMove = moves.find((m) => m.to === square);

            if (targetMove) {
                setSelectedSquare(null);
                setOptionSquares({});

                if (targetMove.promotion) {
                    const game = new Chess(fen);
                    setPendingPromotion({
                        from: selectedSquare,
                        to: square,
                        color: game.turn(),
                    });
                    return;
                }

                onPieceDrop(selectedSquare, square, undefined);
                return;
            }
        }

        // Select the clicked square if it has legal moves
        const moves = getMovesFrom(square);

        if (moves.length === 0) {
            setSelectedSquare(null);
            setOptionSquares({});
            return;
        }

        const game = new Chess(fen);
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

        if (isPromotionMove(sourceSquare, targetSquare)) {
            const game = new Chess(fen);
            setPendingPromotion({
                from: sourceSquare,
                to: targetSquare,
                color: game.turn(),
            });
            return false; // don't execute the move yet
        }

        return onPieceDrop(sourceSquare, targetSquare, undefined);
    }

    function handlePromotionSelect(promotionPiece) {
        if (!pendingPromotion) return;
        const { from, to } = pendingPromotion;
        setPendingPromotion(null);
        onPieceDrop(from, to, promotionPiece);
    }

    const squareStyles = {
        ...(selectedSquare && {
            [selectedSquare]: { background: "rgba(255, 102, 196, 0.5)" },
        }),
        ...optionSquares,
    };

    return (
        <>
            {pendingPromotion && (
                <PawnPromotionModal
                    color={pendingPromotion.color}
                    onSelect={handlePromotionSelect}
                />
            )}

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
        </>
    );
}