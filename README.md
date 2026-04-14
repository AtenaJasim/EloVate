<h1 align = "center">EloVate</h1>

<h3 align="center">Your personal AI chess coach</h3>

![EloVate Screenshot](https://github.com/AtenaJasim/EloVate/raw/main/public/elovate.png)

## Purpose

Most chess apps let you play against a computer, but don't explain what you did wrong or how to improve.
EloVate gives you real time coaching while you play. After every move, you find out how strong or weak your choice was, and you get a better suggestion when one exists.

The goal is to help players grow their game naturally, without having to leave the board to study.

## How it works

1. Choose your color and a difficulty level to start a new game.
2. Make a move on the board.
3. EloVate sends the position to Stockfish for evaluation.
4. Your move is rated and compared against the engine's best choice.
5. The app explains the result and shows a stronger move when one is available.
6. The computer plays its response and the cycle continues.

## Move feedback

After each move you make, EloVate:

- Rates the move (e.g. excellent, good, inaccuracy, blunder)
- Explains why the move was strong or weak
- Shows a better move from the engine when one exists

## Game controls

- Play as White or Black
- Adjust difficulty at the start of any game
- Undo the last move at any time
- Start a new game whenever you like

## Play here: deployed on Vercel!
https://elovate-neon.vercel.app/

As a webapp it is playable on both mobile and desktop applications! If using a mobile device such as a phone or ipad, simple click the link and add to your homescreen to get the app experience!


## Tech stack

- React
- Vite
- JavaScript
- chess.js
- react-chessboard
- Stockfish
