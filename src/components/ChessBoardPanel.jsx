import { Chessboard } from "react-chessboard";

export default function ChessBoardPanel({ fen, onPieceDrop }) {
    return (
        <div className="board-shell">
            <Chessboard
                options={{
                    position: fen,
                    onPieceDrop: ({ sourceSquare, targetSquare }) =>
                        onPieceDrop(sourceSquare, targetSquare),
                    lightSquareStyle: {
                        backgroundColor: "#f5ead7",
                    },
                    darkSquareStyle: {
                        backgroundColor: "#8b6b52",
                    },
                    boardStyle: {
                        borderRadius: "22px",
                        boxShadow: "0 18px 40px rgba(0, 0, 0, 0.35)",
                    },
                }}
            />
        </div>
    );
}