# EloVate

EloVate is an AI chess tutor built to help players improve while they play!

While playing against a computer, users also get feedback on their moves. After each move, the app evaluates what was played, explains how strong or weak it was, and suggests a better move when one exists.

## Features

- Play against the computer at different difficulty levels
- Choose to play as White or Black
- Get move-by-move feedback after every turn
- See how your move was evaluated
- Get a stronger suggested move from the engine
- Undo the last move
- Start a new game at any time

## How It Works

EloVate uses Stockfish to analyze positions and compare the move you played against stronger engine choices.

After you make a move, the app:
- checks the position with the engine
- rates your move
- explains the result
- shows a better move when available
- then lets the computer respond

## Tech Stack

- React
- Vite
- JavaScript
- chess.js
- react-chessboard
- Stockfish
