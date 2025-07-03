const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

const games = new Map();

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function calculateBullsAndCows(secret, guess) {
    let bulls = 0;
    let cows = 0;
    if (secret && guess) {
        for (let i = 0; i < 4; i++) {
            if (guess[i] === secret[i]) {
                bulls++;
            } else if (secret.includes(guess[i])) {
                cows++;
            }
        }
    }
    return { bulls, cows };
}

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('createRoom', () => {
        const roomCode = generateRoomCode();
        games.set(roomCode, {
            players: [socket.id],
            secretNumbers: [null, null],
            currentPlayer: 0,
            attempts: [0, 0],
            correctGuesses: [false, false]
        });
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
        console.log(`Room created: ${roomCode} by player ${socket.id}`);
    });

    socket.on('joinRoom', (roomCode) => {
        console.log(`Attempt to join room: ${roomCode} by player ${socket.id}`);
        const game = games.get(roomCode);
        if (game && game.players.length < 2) {
            game.players.push(socket.id);
            socket.join(roomCode);
            io.to(roomCode).emit('gameStart', { players: game.players, roomCode });
            console.log(`Player ${socket.id} joined room: ${roomCode}`);
        } else {
            socket.emit('joinError', 'Room not found or full');
        }
    });

    socket.on('setSecretNumber', ({ roomCode, secretNumber }) => {
        console.log(`Setting secret number for room: ${roomCode} by player ${socket.id}`);
        const game = games.get(roomCode);
        if (game) {
            const playerIndex = game.players.indexOf(socket.id);
            if (playerIndex !== -1 && /^\d{4}$/.test(secretNumber) && new Set(secretNumber).size === 4) {
                game.secretNumbers[playerIndex] = secretNumber;
                console.log(`Secret number set for player ${playerIndex + 1} in room ${roomCode}`);
                if (game.secretNumbers.every(num => num !== null)) {
                    io.to(roomCode).emit('allSecretNumbersSet');
                    console.log(`Both players have set their secret numbers in room ${roomCode}`);
                }
            } else {
                socket.emit('error', 'Invalid secret number or player not in room');
            }
        } else {
            socket.emit('error', 'Game not found');
        }
    });

    socket.on('makeGuess', ({ roomCode, guess }) => {
        console.log(`Guess made in room ${roomCode} by player ${socket.id}: ${guess}`);
        const game = games.get(roomCode);
        if (game) {
            const playerIndex = game.players.indexOf(socket.id);
            const opponentIndex = 1 - playerIndex;
            const secretNumber = game.secretNumbers[opponentIndex];
            if (secretNumber) {
                const { bulls, cows } = calculateBullsAndCows(secretNumber, guess);
                game.attempts[playerIndex]++;
                io.to(roomCode).emit('guessMade', { player: socket.id, guess, bulls, cows });
                if (bulls === 4) {
                    game.correctGuesses[playerIndex] = true;
                    if (game.correctGuesses.every(guess => guess)) {
                        const winner = game.attempts[0] <= game.attempts[1] ? game.players[0] : game.players[1];
                        io.to(roomCode).emit('gameOver', {
                            winner,
                            player1Attempts: game.attempts[0],
                            player2Attempts: game.attempts[1]
                        });
                        games.delete(roomCode);
                        console.log(`Game over in room ${roomCode}`);
                    } else {
                        io.to(roomCode).emit('playerGuessedCorrectly', { player: socket.id });
                    }
                }
            } else {
                socket.emit('error', 'Opponent has not set their secret number yet');
            }
        } else {
            socket.emit('error', 'Game not found');
        }
    });

    socket.on('chat message', ({ roomCode, message }) => {
        io.to(roomCode).emit('chat message', { sender: socket.id, message });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        for (const [roomCode, game] of games.entries()) {
            const playerIndex = game.players.indexOf(socket.id);
            if (playerIndex !== -1) {
                game.players.splice(playerIndex, 1);
                if (game.players.length === 0) {
                    games.delete(roomCode);
                    console.log(`Room ${roomCode} deleted`);
                } else {
                    io.to(roomCode).emit('playerLeft', socket.id);
                    console.log(`Player ${socket.id} left room ${roomCode}`);
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
