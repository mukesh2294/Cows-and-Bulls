const socket = io({
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
});

const anime = window.anime;

let currentRoomCode = null;

const elements = {
    roomCodeDisplay: document.getElementById('roomCodeDisplay'),
    createRoomBtn: document.getElementById('createRoomBtn'),
    joinRoomInput: document.getElementById('joinRoomInput'),
    joinRoomBtn: document.getElementById('joinRoomBtn'),
    lobby: document.getElementById('lobby'),
    gameArea: document.getElementById('gameArea'),
    gameBoard: document.querySelector('.game-board'),
    secretNumberInput: document.getElementById('secretNumberInput'),
    submitSecretBtn: document.getElementById('submitSecretBtn'),
    guessInput: document.getElementById('guessInput'),
    submitGuessBtn: document.getElementById('submitGuessBtn'),
    message: document.getElementById('message'),
    yourGuessList: document.getElementById('yourGuessList'),
    opponentGuessList: document.getElementById('opponentGuessList'),
    chatBox: document.getElementById('chatBox'),
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput'),
    sendChatBtn: document.getElementById('sendChatBtn')
};

function setupEventListeners() {
    elements.createRoomBtn.addEventListener('click', createRoom);
    elements.joinRoomBtn.addEventListener('click', joinRoom);
    elements.submitSecretBtn.addEventListener('click', submitSecretNumber);
    elements.submitGuessBtn.addEventListener('click', submitGuess);
    elements.sendChatBtn.addEventListener('click', sendChatMessage);
    elements.chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
}

function createRoom() {
    socket.emit('createRoom');
    console.log('Create room request sent');
    animateButton(elements.createRoomBtn);
}

function joinRoom() {
    const roomCode = elements.joinRoomInput.value.toUpperCase();
    socket.emit('joinRoom', roomCode);
    console.log(`Join room request sent for room: ${roomCode}`);
    animateButton(elements.joinRoomBtn);
}

function submitSecretNumber() {
    const secretNumber = elements.secretNumberInput.value;
    if (isValidNumber(secretNumber)) {
        socket.emit('setSecretNumber', { roomCode: currentRoomCode, secretNumber });
        console.log(`Secret number submitted: ${secretNumber}`);
        elements.secretNumberInput.disabled = true;
        elements.submitSecretBtn.disabled = true;
        elements.message.textContent = 'Waiting for opponent...';
        animateButton(elements.submitSecretBtn);
    } else {
        alert('Please enter a valid 4-digit number with unique digits');
    }
}

function submitGuess() {
    const guess = elements.guessInput.value;
    if (isValidNumber(guess)) {
        socket.emit('makeGuess', { roomCode: currentRoomCode, guess });
        console.log(`Guess submitted: ${guess}`);
        elements.guessInput.value = '';
        animateButton(elements.submitGuessBtn);
    } else {
        alert('Please enter a valid 4-digit number with unique digits');
    }
}

function sendChatMessage() {
    const message = elements.chatInput.value.trim();
    if (message) {
        socket.emit('chat message', { roomCode: currentRoomCode, message });
        elements.chatInput.value = '';
        animateButton(elements.sendChatBtn);
    }
}

function isValidNumber(num) {
    return /^\d{4}$/.test(num) && new Set(num).size === 4;
}

function animateButton(button) {
    anime({
        targets: button,
        scale: [1, 0.95, 1],
        duration: 300,
        easing: 'easeInOutQuad'
    });
}

function createConfetti() {
    const confettiCount = 200;
    const confettiColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    const confetti = document.getElementById('confetti');

    for (let i = 0; i < confettiCount; i++) {
        const confettiPiece = document.createElement('div');
        confettiPiece.classList.add('confetti-piece');
        confettiPiece.style.backgroundColor = confettiColors[Math.floor(Math.random() * confettiColors.length)];
        confettiPiece.style.left = `${Math.random() * 100}vw`;
        confettiPiece.style.animationDelay = `${Math.random() * 5}s`;
        confetti.appendChild(confettiPiece);
    }

    setTimeout(() => {
        confetti.innerHTML = '';
    }, 5000);
}

function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to server');
        elements.message.textContent = 'Connected to server';
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        elements.message.textContent = 'Disconnected from server. Trying to reconnect...';
    });

    socket.on('roomCreated', (roomCode) => {
        currentRoomCode = roomCode;
        elements.roomCodeDisplay.textContent = `Room Code: ${roomCode}`;
        elements.lobby.classList.add('hidden');
        elements.gameArea.classList.remove('hidden');
        elements.message.textContent = 'Waiting for opponent to join...';
        console.log(`Room created with code: ${roomCode}`);
        anime({
            targets: elements.gameArea,
            opacity: [0, 1],
            translateY: [20, 0],
            duration: 500,
            easing: 'easeOutQuad'
        });
    });

    socket.on('gameStart', ({ players, roomCode }) => {
        currentRoomCode = roomCode;
        elements.lobby.classList.add('hidden');
        elements.gameArea.classList.remove('hidden');
        elements.message.textContent = players[0] === socket.id ? 'Enter your secret number' : 'Waiting for opponent to enter secret number';
        console.log(`Game started in room: ${roomCode}`);
        anime({
            targets: elements.gameArea,
            opacity: [0, 1],
            translateY: [20, 0],
            duration: 500,
            easing: 'easeOutQuad'
        });
    });

    socket.on('allSecretNumbersSet', () => {
        elements.guessInput.disabled = false;
        elements.submitGuessBtn.disabled = false;
        elements.message.textContent = 'Both players have set their numbers. Start guessing!';
        console.log('All secret numbers set, guessing phase started');
        anime({
            targets: elements.message,
            backgroundColor: ['#4CAF50', '#f0f0f0'],
            duration: 1000,
            easing: 'easeInOutQuad'
        });
    });

    socket.on('guessMade', ({ player, guess, bulls, cows }) => {
        console.log(`Guess made by ${player === socket.id ? 'you' : 'opponent'}: ${guess}`);
        const guessResult = `<p>Guess: ${guess} - Bulls: ${bulls}, Cows: ${cows}</p>`;
        const targetList = player === socket.id ? elements.yourGuessList : elements.opponentGuessList;
        const newGuessElement = document.createElement('div');
        newGuessElement.innerHTML = guessResult;
        targetList.appendChild(newGuessElement);
        
        anime({
            targets: newGuessElement,
            opacity: [0, 1],
            translateY: [20, 0],
            duration: 500,
            easing: 'easeOutQuad'
        });

        if (bulls === 4 && player === socket.id) {
            elements.message.textContent = 'You guessed correctly! Waiting for the other player...';
            elements.guessInput.disabled = true;
            elements.submitGuessBtn.disabled = true;
        }
    });

    socket.on('playerGuessedCorrectly', ({ player }) => {
        if (player !== socket.id) {
            elements.message.textContent = 'Opponent guessed correctly. Make your final guesses!';
            anime({
                targets: elements.message,
                backgroundColor: ['#FFA500', '#f0f0f0'],
                duration: 1000,
                easing: 'easeInOutQuad'
            });
        }
    });

    socket.on('gameOver', ({ winner, player1Attempts, player2Attempts }) => {
        console.log('Game over');
        elements.message.innerHTML = '<h3>Game Over</h3>';
        elements.message.innerHTML += `<p>Player 1 attempts: ${player1Attempts}</p>`;
        elements.message.innerHTML += `<p>Player 2 attempts: ${player2Attempts}</p>`;
        elements.message.innerHTML += `<p>${winner === socket.id ? 'You win!' : 'You lose!'}</p>`;
        elements.guessInput.disabled = true;
        elements.submitGuessBtn.disabled = true;

        if (winner === socket.id) {
            createConfetti();
            anime({
                targets: elements.message,
                scale: [1, 1.1, 1],
                duration: 1000,
                easing: 'easeInOutQuad'
            });
        }
    });

    socket.on('joinError', (errorMessage) => {
        console.error(`Join error: ${errorMessage}`);
        alert(errorMessage);
    });

    socket.on('playerLeft', (playerId) => {
        console.log(`Player ${playerId} left the game`);
        elements.message.textContent = 'Your opponent left the game.';
        elements.guessInput.disabled = true;
        elements.submitGuessBtn.disabled = true;
        anime({
            targets: elements.message,
            backgroundColor: ['#FF0000', '#f0f0f0'],
            duration: 1000,
            easing: 'easeInOutQuad'
        });
    });

    socket.on('error', (errorMessage) => {
        console.error(`Error: ${errorMessage}`);
        alert(errorMessage);
    });

    socket.on('chat message', ({ sender, message }) => {
        const messageElement = document.createElement('div');
        messageElement.textContent = `${sender === socket.id ? 'You' : 'Opponent'}: ${message}`;
        elements.chatMessages.appendChild(messageElement);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
        
        anime({
            targets: messageElement,
            opacity: [0, 1],
            translateY: [20, 0],
            duration: 500,
            easing: 'easeOutQuad'
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupSocketListeners();
});

console.log('Client-side script loaded');
