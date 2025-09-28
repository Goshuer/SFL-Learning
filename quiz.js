// quiz.js
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
let progress = {};
let filteredPlayers = [];
let currentQuizPlayer = null;
let quizActive = true;

// --- LocalStorage helpers ---
function saveProgress() { localStorage.setItem("blsl_quiz", JSON.stringify(progress)); }
function loadProgress() { let data = localStorage.getItem("blsl_quiz"); progress = data ? JSON.parse(data) : {}; }

// --- Club Selection ---
function renderClubSelector() {
    const clubsSet = {};
    allPlayers.forEach(p => clubsSet[p['Club Name']] = p['Club Badge URL']);
    clubBar.innerHTML = "";
    // "Alle auswählen/abwählen"
    let allSelected = (Object.keys(clubsSet).every(club => selectedClubs.includes(club)));
    let btnAll = document.createElement("button");
    btnAll.className = "club-btn-all" + (allSelected ? " selected" : "");
    btnAll.innerHTML = `<img src="${Object.values(clubsSet)[0]}"><span>${allSelected ? "Alle abwählen" : "Alle auswählen"}</span>`;
    btnAll.onclick = () => {
        if (allSelected) selectedClubs = []; else selectedClubs = Object.keys(clubsSet);
        renderClubSelector(); resetQuiz();
    };
    clubBar.appendChild(btnAll);

    Object.entries(clubsSet).forEach(([name, url]) => {
        let btn = document.createElement("button");
        btn.className = "club-btn" + (selectedClubs.includes(name) ? " selected" : "");
        btn.innerHTML = `<img src="${url}" style="aspect-ratio:1/1;">`;
        btn.title = name;
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

// --- Filter Players for Quiz ---
function updateFilteredPlayers() {
    filteredPlayers = allPlayers.filter(p => selectedClubs.includes(p['Club Name']) && (progress[p.id] || 0) < 2);
}

// --- Random Quiz Player ---
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
    let sameClubPlayers = optionsPool.filter(p => p['Club Name'] === currentQuizPlayer['Club Name'] && p.id !== currentQuizPlayer.id);
    let others = shuffle(sameClubPlayers).slice(0, 3);
    let options = shuffle([currentQuizPlayer, ...others]);
    renderQuiz(currentQuizPlayer, options);
}

// --- Quizanzeige bauen ---
function renderQuiz(player, options) {
    quizBody.innerHTML = `
        <div class="quiz-layout">
            <div class="player-img-wrap">
                <img class="player-img" src="${player['Player Image URL']}" alt="Spielerfoto">
            </div>
            <div class="info-col">
                <div class="circle-icon" title="Club">
                  <img src="${player['Club Badge URL']}" style="aspect-ratio:1/1;">
                </div>
                <div class="circle-icon" title="Flagge 1">
                  <img src="${player['Nationality 1 Flag URL']}" style="object-fit:contain; aspect-ratio:7/5;">
                </div>
                ${player['Nationality 2 Flag URL'] ? `<div class="circle-icon" title="Flagge 2">
                  <img src="${player['Nationality 2 Flag URL']}" style="object-fit:contain; aspect-ratio:7/5;">
                </div>` : ""}
                <div class="circle-icon" title="Position">
                  <span class="info-label">${player.Position || ""}</span>
                </div>
                <div class="circle-icon" title="Trikotnummer">
                  <span class="info-label">#${player['Jersey Number']}</span>
                </div>
            </div>
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
        progress[player.id] = Math.min((progress[player.id] || 0) + 1, 2);
        saveProgress();
        renderProgress();
        setTimeout(pickQuizPlayer, 600);
    } else {
        let ansBtns = [...document.getElementsByClassName("ans-btn")];
        let correctBtn = ansBtns.find(b => b.textContent === player['Player Name']);
        correctBtn.classList.add("show-correct");
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
    selectedClubs = [...new Set(allPlayers.map(p => p['Club Name']))];
    renderClubSelector();
    renderProgress();
    pickQuizPlayer();
})();
