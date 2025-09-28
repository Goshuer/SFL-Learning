// quiz.js

// --- CSV Loader (simple) ---
async function loadCSV(url) {
    let res = await fetch(url);
    let text = await res.text();
    let [head, ...lines] = text.trim().split(/\r?\n/);
    let headers = head.split(',').map(h => h.trim());
    return lines.map(line => {
        const cells = [];
        let curr = '';
        let insideQuotes = false;
        for (let c of line) {
            if (c === '"' && insideQuotes) { insideQuotes = false; continue; }
            if (c === '"' && !insideQuotes) { insideQuotes = true; continue; }
            if (c === ',' && !insideQuotes) { cells.push(curr); curr = ''; continue; }
            curr += c;
        }
        cells.push(curr);
        let obj = {};
        headers.forEach((h, i) => obj[h] = (cells[i] || '').trim());
        obj.id = `${obj['Club Name']}::${obj['Player Name']}`; // unique
        return obj;
    });
}

// --- Get elements ---
const clubBar = document.getElementById("clubSelectBar");
const quizBody = document.getElementById("quizBody");
const progressBox = document.getElementById("progress");

// --- GLOBAL STATE ---
let allPlayers = [];
let selectedClubs = [];
let progress = {}; // { [playerId]: Zahl }
let filteredPlayers = [];
let currentQuizPlayer = null;
let quizActive = true;

// --- LocalStorage helpers ---
function saveProgress() {
    localStorage.setItem("blsl_quiz", JSON.stringify(progress));
}
function loadProgress() {
    let data = localStorage.getItem("blsl_quiz");
    progress = data ? JSON.parse(data) : {};
}

// --- Club Selection ---
function renderClubSelector() {
    const clubsSet = {};
    allPlayers.forEach(p => clubsSet[p['Club Name']] = p['Club Badge URL']);
    clubBar.innerHTML = "";
    Object.entries(clubsSet).forEach(([name, url]) => {
        let btn = document.createElement("button");
        btn.className = "club-btn" + (selectedClubs.includes(name) ? " selected" : "");
        btn.innerHTML = `<img src="${url}"><br><span style="font-size: .8em;">${name}</span>`;
        btn.addEventListener("click", () => {
            if (selectedClubs.includes(name)) {
                selectedClubs = selectedClubs.filter(club => club !== name);
            } else {
                selectedClubs.push(name);
            }
            renderClubSelector();
            resetQuiz();
        });
        clubBar.appendChild(btn);
    });
}

// --- Progress & Learned Count ---
function renderProgress() {
    let teamPlayers = allPlayers.filter(p => selectedClubs.includes(p['Club Name']));
    let learned = teamPlayers.filter(p => (progress[p.id] || 0) >= 2).length;
    progressBox.textContent = `${learned}/${teamPlayers.length} gelernt`;
}

// --- Filter Players for Quiz (not yet learned, or 1x gewusst) ---
function updateFilteredPlayers() {
    filteredPlayers = allPlayers.filter(p => selectedClubs.includes(p['Club Name'])
        && (progress[p.id] || 0) < 2);
}

// --- Random Quiz Player und Antwortoptionen auswählen ---
function pickQuizPlayer() {
    updateFilteredPlayers();
    if (filteredPlayers.length === 0) {
        quizBody.innerHTML = "";
        let clubList = selectedClubs.map(club => `<b>${club}</b>`).join(", ");
        quizBody.innerHTML = `
          <div class="result-msg">
            Gratuliere! Du kennst nun alle Spieler von ${clubList}.
          </div>
          <div class="quiz-btn-bar">
            <button onclick="resetProgress()">Quiz wiederholen</button>
            <button onclick="setTimeout(() => location.reload(), 100)">Teams wechseln</button>
          </div>
        `;
        quizActive = false;
        return;
    }
    quizActive = true;
    let optionsPool = allPlayers.filter(p => selectedClubs.includes(p['Club Name']));
    currentQuizPlayer = filteredPlayers[Math.floor(Math.random() * filteredPlayers.length)];
    // Antwortoptionen: 3 weitere aus gleichem Team, keine Dopplung, mischen.
    let sameClubPlayers = optionsPool.filter(p => p['Club Name'] === currentQuizPlayer['Club Name'] && p.id !== currentQuizPlayer.id);
    let others = shuffle(sameClubPlayers).slice(0, 3);
    let options = shuffle([currentQuizPlayer, ...others]);
    renderQuiz(currentQuizPlayer, options);
}

// --- Quizanzeige bauen ---
function renderQuiz(player, options) {
    quizBody.innerHTML = `
        <div style="display:flex;justify-content:center;align-items:center;">
            <img class="player-img" src="${player['Player Image URL']}" alt="Spielerfoto">
        </div>
        <div class="info-row">
            <img class="info-icon" src="${player['Club Badge URL']}" title="${player['Club Name']}">
            <img class="info-icon" src="${player['Nationality 1 Flag URL']}" title="${player['Nationality 1']}">
            ${player['Nationality 2 Flag URL'] ? `<img class="info-icon" src="${player['Nationality 2 Flag URL']}" title="${player['Nationality 2']}">` : ""}
            <span class="info-label">${player.Position || ""}</span>
            <span class="info-label">#${player['Jersey Number']}</span>
        </div>
        <div class="ans-btns" id="ansBlock"></div>
    `;
    let ansBlock = document.getElementById("ansBlock");
    options.forEach(opt => {
        let btn = document.createElement("button");
        btn.className = "ans-btn";
        btn.textContent = opt['Player Name'];
        btn.onclick = () => handleAnswer(opt, btn, player, options);
        ansBlock.appendChild(btn);
    });
}

// --- Antwortprüfung / Feedback ---
function handleAnswer(opt, btn, player, options) {
    if (!quizActive) return;
    let isCorrect = (opt.id === player.id);
    if (isCorrect) {
        btn.classList.add("correct");
        // Fortschritt erhöhen (max 2), speichern
        progress[player.id] = Math.min((progress[player.id] || 0) + 1, 2);
        saveProgress();
        renderProgress();
        setTimeout(pickQuizPlayer, 600);
    } else {
        let ansBtns = [...document.getElementsByClassName("ans-btn")];
        let correctBtn = ansBtns.find(b => b.textContent === player['Player Name']);
        correctBtn.classList.add("show-correct");
        // But Progress only if not correct
        setTimeout(pickQuizPlayer, 1200);
    }
}

// --- Shuffle Helper ---
function shuffle(arr) {
    let a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// --- Quiz Reset / Progress Reset ---
function resetQuiz() {
    updateFilteredPlayers();
    renderClubSelector();
    renderProgress();
    pickQuizPlayer();
}
function resetProgress() {
    let teamPlayers = allPlayers.filter(p => selectedClubs.includes(p['Club Name']));
    teamPlayers.forEach(p => { progress[p.id] = 0; });
    saveProgress();
    resetQuiz();
}

// --- Initial Load ---
(async function () {
    loadProgress();
    allPlayers = await loadCSV("spieler.csv");
    // Standard alle Clubs wählen (oder nach Wunsch) 
    selectedClubs = [...new Set(allPlayers.map(p => p['Club Name']))];
    renderClubSelector();
    renderProgress();
    pickQuizPlayer();
})();
