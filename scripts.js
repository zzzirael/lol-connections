document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('grid-container');
    const submitButton = document.getElementById('submit-button');
    const shuffleButton = document.getElementById('shuffle-button');
    const mistakesDotsContainer = document.getElementById('mistakes-dots');
    const feedbackMessage = document.getElementById('feedback-message');
    const solvedContainer = document.getElementById('solved-groups-container');
    const puzzleDateEl = document.getElementById('puzzle-date');
    const puzzleSelector = document.getElementById('puzzle-selector');
    const infiniteModeButton = document.getElementById('infinite-mode-button');

    let selectedItems = [];
    let mistakes = 0;
    const MAX_MISTAKES = 4;
    let currentPuzzleData;
    let solvedGroupsCount = 0;
    let allPuzzlesData;
    let isInfiniteMode = false;
    
    let championIconMap = new Map();
    let itemIconMap = new Map();
    const CDRAGON_BASE_URL = "https://raw.communitydragon.org/latest/";

    async function initializeApp() {
        const championsURL = `${CDRAGON_BASE_URL}plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json`;
        const itemsURL = `${CDRAGON_BASE_URL}plugins/rcp-be-lol-game-data/global/default/v1/items.json`;

        try {
            const [puzzleResponse, championsResponse, itemsResponse] = await Promise.all([
                fetch('puzzles.json'),
                fetch(championsURL),
                fetch(itemsURL)
            ]);

            if (!puzzleResponse.ok || !championsResponse.ok || !itemsResponse.ok) {
                throw new Error('Falha ao carregar os dados do jogo do servidor.');
            }

            allPuzzlesData = await puzzleResponse.json();
            const championsData = await championsResponse.json();
            const itemsData = await itemsResponse.json();

            championsData.forEach(champ => {
                if(champ.name) championIconMap.set(champ.name, champ.squarePortraitPath);
            });
            itemsData.forEach(item => {
                if(item.name) itemIconMap.set(item.name, item.iconPath);
            });

            populatePuzzleSelector();

            const latestDate = Object.keys(allPuzzlesData).sort((a, b) => b.localeCompare(a))[0];
            if (latestDate) {
                loadPuzzle(latestDate);
            } else {
                gridContainer.innerHTML = "<p>Nenhum puzzle encontrado!</p>";
            }

        } catch (error) {
            console.error("Falha ao carregar os dados:", error);
            gridContainer.innerHTML = "<p>Não foi possível carregar o jogo. Tente novamente mais tarde.</p>";
        }
    }

    function populatePuzzleSelector() {
        const sortedDates = Object.keys(allPuzzlesData).sort((a, b) => b.localeCompare(a));
        puzzleSelector.innerHTML = '';
        sortedDates.forEach(dateString => {
            const option = document.createElement('option');
            option.value = dateString;
            const formattedDate = new Date(dateString.replace(/-/g, '\/')).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            option.textContent = formattedDate;
            puzzleSelector.appendChild(option);
        });
    }
    
    function loadPuzzle(dateString) {
        selectedItems = [];
        mistakes = 0;
        solvedGroupsCount = 0;
        solvedContainer.innerHTML = '';
        submitButton.disabled = false;
        shuffleButton.disabled = false;
        
        currentPuzzleData = allPuzzlesData[dateString];
        puzzleSelector.value = dateString;
        puzzleDateEl.textContent = new Date(dateString.replace(/-/g, '\/')).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
        
        const allItems = Object.values(currentPuzzleData.groups).flatMap(group => group.items);
        for (let i = allItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
        }
        currentPuzzleData.startingBoard = allItems;
        
        createGrid(currentPuzzleData.startingBoard);
        updateMistakesDisplay();
    }

    function createGrid(items) {
        gridContainer.innerHTML = '';
        items.forEach(itemName => {
            const itemElement = document.createElement('div');
            itemElement.classList.add('grid-item');
            itemElement.dataset.name = itemName;
            const iconPath = championIconMap.get(itemName) || itemIconMap.get(itemName);
            let imageUrl = 'URL_IMAGEM_PADRAO_NAO_ENCONTRADO.png';
            if (iconPath) {
                 imageUrl = `${CDRAGON_BASE_URL}${iconPath.replace('/lol-game-data/assets/', 'plugins/rcp-be-lol-game-data/global/default/').toLowerCase()}`;
            } else {
                 console.warn(`Ícone não encontrado para: ${itemName}`);
            }
            itemElement.innerHTML = `
                <img src="${imageUrl}" alt="${itemName}" onerror="this.src='https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/3001.png'; this.onerror=null;"/>
                <span>${itemName}</span>
            `;
            itemElement.addEventListener('click', () => handleItemClick(itemElement));
            gridContainer.appendChild(itemElement);
        });
    }

    function handleItemClick(itemElement) {
        const itemName = itemElement.dataset.name;
        if (itemElement.classList.contains('selected')) {
            selectedItems = selectedItems.filter(item => item !== itemName);
            itemElement.classList.remove('selected');
        } else {
            if (selectedItems.length < 4) {
                selectedItems.push(itemName);
                itemElement.classList.add('selected');
            }
        }
    }
    
    function handleSubmit() {
        if (selectedItems.length !== 4) {
            showFeedback("Selecione 4 itens.");
            return;
        }
        const groupName = findGroupForSelection(selectedItems);
        if (groupName) {
            showFeedback("Correto!", true);
            handleCorrectGroup(groupName, selectedItems);
            document.querySelectorAll('.grid-item.selected').forEach(el => el.classList.remove('selected'));
            selectedItems = [];
        } else {
            if (!isInfiniteMode) {
                mistakes++;
                updateMistakesDisplay();
            }
            showFeedback("Tente novamente.");
            if (!isInfiniteMode && mistakes >= MAX_MISTAKES) {
                setTimeout(() => alert("Fim de jogo! Você perdeu."), 200);
                submitButton.disabled = true;
                shuffleButton.disabled = true;
            }
        }
    }

    function showFeedback(message, isSuccess = false) {
        feedbackMessage.textContent = message;
        feedbackMessage.classList.toggle('success', isSuccess);
        feedbackMessage.classList.toggle('error', !isSuccess);
        setTimeout(() => feedbackMessage.textContent = '', 2000);
    }

    function findGroupForSelection(selection) {
        for (const groupName in currentPuzzleData.groups) {
            const groupItems = currentPuzzleData.groups[groupName].items;
            const selectionSet = new Set(selection);
            const groupSet = new Set(groupItems);
            if (selectionSet.size === groupSet.size && [...selectionSet].every(item => groupSet.has(item))) {
                return groupName;
            }
        }
        return null;
    }

    function handleCorrectGroup(groupName, items) {
        const groupInfo = currentPuzzleData.groups[groupName];
        const solvedGroupEl = document.createElement('div');
        solvedGroupEl.classList.add('solved-group');
        const colors = ['#a4c8d1', '#85b8a8', '#e8d5a3', '#d9a3a3'];
        solvedGroupEl.style.backgroundColor = colors[groupInfo.level - 1] || '#cccccc';
        solvedGroupEl.innerHTML = `
            <h3>${groupName}</h3>
            <p>${items.join(', ')}</p>
        `;
        solvedContainer.appendChild(solvedGroupEl);
        items.forEach(itemName => {
            const itemEl = gridContainer.querySelector(`[data-name="${itemName}"]`);
            if (itemEl) itemEl.remove();
        });
        solvedGroupsCount++;
        if (solvedGroupsCount === Object.keys(currentPuzzleData.groups).length) {
             setTimeout(() => alert("Parabéns, você venceu!"), 200);
            submitButton.disabled = true;
            shuffleButton.disabled = true;
        }
    }

    function updateMistakesDisplay() {
        mistakesDotsContainer.innerHTML = '';
        const dotsToShow = isInfiniteMode ? MAX_MISTAKES : MAX_MISTAKES - mistakes;
        for (let i = 0; i < dotsToShow; i++) {
            const dot = document.createElement('div');
            dot.classList.add('mistake-dot');
            mistakesDotsContainer.appendChild(dot);
        }
    }

    function shuffleGrid() {
        const items = Array.from(gridContainer.children);
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            gridContainer.appendChild(items[j]);
        }
    }
    
    function toggleInfiniteMode() {
        isInfiniteMode = !isInfiniteMode;
        infiniteModeButton.textContent = `Unlimited Mode: ${isInfiniteMode ? 'On' : 'Off'}`;
        infiniteModeButton.classList.toggle('active', isInfiniteMode);
        updateMistakesDisplay();
    }

    submitButton.addEventListener('click', handleSubmit);
    shuffleButton.addEventListener('click', shuffleGrid);
    puzzleSelector.addEventListener('change', (event) => loadPuzzle(event.target.value));
    infiniteModeButton.addEventListener('click', toggleInfiniteMode);

    initializeApp();
});