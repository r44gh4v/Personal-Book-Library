// DOM Elements
const recommendationList = document.getElementById('recommendation-list');
const genreSelector = document.getElementById('genre-selector');
const reloadBtn = document.getElementById('reload-suggestions');
const searchBar = document.getElementById('search-bar');
const searchResults = document.getElementById('search-results');
const shelfSelector = document.getElementById('shelf-selector');
const addToShelfButton = document.getElementById('add-to-shelf-button');
const scrollLeftBtn = document.querySelector('.scroll-btn.left');
const scrollRightBtn = document.querySelector('.scroll-btn.right');
const shelves = {
    toRead: document.querySelector('#to-read .book-list'),
    reading: document.querySelector('#reading .book-list'),
    completed: document.querySelector('#completed .book-list')
};
const counters = {
    toRead: document.querySelector('#to-read-books-count'),
    reading: document.querySelector('#reading-books-count'),
    completed: document.querySelector('#completed-books-count')
};

// State
let selectedBook = null;
let library = JSON.parse(localStorage.getItem('library')) || {
    toRead: [],
    reading: [],
    completed: []
};

// Add this helper function near the top (e.g., after state declarations)
function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '…' : text;
}

// Initialize
async function init() {
    setupEventListeners();
    await fetchRecommendations(); // Always fetch on initial load
    updateAllShelves();
}

// Event Listeners
function setupEventListeners() {
    reloadBtn.addEventListener('click', fetchRecommendations);
    genreSelector.addEventListener('change', () => {
        // Fetch new recommendations whenever genre changes
        fetchRecommendations();
    });
    scrollLeftBtn.addEventListener('click', () => scrollRecommendations('left'));
    scrollRightBtn.addEventListener('click', () => scrollRecommendations('right'));
    searchBar.addEventListener('input', debounce(handleSearch, 300));
    addToShelfButton.addEventListener('click', handleAddToShelf);
    setupDragAndDrop();
}

// Updated fetch recommendations
async function fetchRecommendations() {
    const genre = genreSelector.value;
    let query;

    switch (genre) {
        case 'random':
            query = getRandomSearchQuery();
            break;
        case 'nonfiction-books':
            query = 'subject:nonfiction';
            break;
        default:
            query = `subject:"${genre}"`;
    }

    // Create loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<p>Loading...</p>';
    document.querySelector('.suggestions-container').appendChild(loadingOverlay);

    try {
        // Add random offset and ordering
        const randomOffset = Math.floor(Math.random() * 100); // Random starting point
        const response = await fetch(
            `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=12&startIndex=${randomOffset}&orderBy=relevance&langRestrict=en`
        );
        const data = await response.json();

        if (data.items) {
            // Shuffle the results before displaying
            const shuffledItems = [...data.items].sort(() => Math.random() - 0.5);
            displayRecommendations(shuffledItems);
        }
    } catch (error) {
        console.error('Error:', error);
        recommendationList.innerHTML = '<p>Failed to load recommendations</p>';
    } finally {
        loadingOverlay.remove();
    }
}

// Get random search query
function getRandomSearchQuery() {
    const queries = [
        'bestseller', 'award winning', 'popular', 'classic literature',
        'contemporary', 'highly rated', 'recommended reading', 'top rated',
        'must read', 'trending', 'notable', 'critically acclaimed',
        'blockbuster', 'celebrated', 'distinguished', 'remarkable'
    ];
    return queries[Math.floor(Math.random() * queries.length)];
}

// Helper function to get secure image URL with fallback
function getSecureImageUrl(volumeInfo) {
    if (!volumeInfo.imageLinks) {
        return 'https://via.placeholder.com/128x192?text=No+Cover';
    }

    // Try thumbnail first, then smallThumbnail, convert to https
    const imageUrl = (volumeInfo.imageLinks.thumbnail || volumeInfo.imageLinks.smallThumbnail || '')
        .replace('http://', 'https://');

    return imageUrl || 'https://via.placeholder.com/128x192?text=No+Cover';
}

// Display recommendations
function displayRecommendations(books) {
    recommendationList.innerHTML = books.map(book => {
        const { volumeInfo } = book;
        const coverUrl = getSecureImageUrl(volumeInfo);

        return `
            <div class="book-card">
                <img src="${coverUrl}" alt="${volumeInfo.title}" 
                     loading="lazy" 
                     onerror="this.onerror=null; this.src='https://via.placeholder.com/128x192?text=No+Cover';">
                <div class="book-info">
                    <h4>${volumeInfo.title}</h4>
                    <p>${volumeInfo.authors?.[0] || 'Unknown Author'}</p>
                </div>
                <div class="actions">
                    <button class="action-btn add btn" onclick="addBookToShelf('${book.id}', 'toRead')" 
                            title="Add to Reading List">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="action-btn info btn" onclick="window.open('${volumeInfo.infoLink}', '_blank')"
                            title="More Info">
                        <i class="fas fa-info"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Updated scroll recommendations
function scrollRecommendations(direction) {
    // Card width (180px) + gap (2rem = 32px) * 2 cards
    const scrollAmount = (180 + 32) * 2; // 424px total scroll distance
    recommendationList.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
    });
}

// Handle search with images
async function handleSearch(event) {
    const query = event.target.value.trim();
    if (query.length < 2) {
        searchResults.classList.remove('active');
        addToShelfButton.disabled = true;
        return;
    }

    try {
        const response = await fetch(
            `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=5&langRestrict=en`
        );
        const data = await response.json();

        if (data.items) {
            displaySearchResults(data.items);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Display search results with images
function displaySearchResults(books) {
    searchResults.innerHTML = books.map(book => {
        const coverUrl = getSecureImageUrl(book.volumeInfo);
        return `
            <div class="search-result-item" onclick="selectSearchResult('${book.id}')">
                <img src="${coverUrl}" alt="${book.volumeInfo.title}"
                     onerror="this.onerror=null; this.src='https://via.placeholder.com/40x60?text=No+Cover';">
                <div class="result-info">
                    <strong>${book.volumeInfo.title}</strong>
                    <small>${book.volumeInfo.authors?.[0] || 'Unknown Author'}</small>
                </div>
            </div>
        `;
    }).join('');
    searchResults.classList.add('active');
}

// Select search result
async function selectSearchResult(bookId) {
    const bookData = await fetchVolume(bookId);
    if (!bookData) return;
    selectedBook = bookData;
    searchBar.value = selectedBook.volumeInfo.title;
    searchResults.classList.remove('active');
    addToShelfButton.disabled = false;
    addToShelfButton.classList.add('active');
}

// Handle adding book to shelf
function handleAddToShelf() {
    if (!selectedBook) return;

    const shelfKey = shelfSelector.value;
    addBookToShelf(selectedBook.id, shelfKey);

    // Reset search state
    searchBar.value = '';
    selectedBook = null;
    addToShelfButton.disabled = true;
    addToShelfButton.classList.remove('active');
}

// Add book to shelf
async function addBookToShelf(bookId, shelfKey) {
    const bookData = await fetchVolume(bookId);
    if (!bookData) return;

    if (!library[shelfKey].some(b => b.id === bookData.id)) {
        library[shelfKey].push({
            id: bookData.id,
            title: bookData.volumeInfo.title,
            author: bookData.volumeInfo.authors?.[0] || 'Unknown Author',
            cover: getSecureImageUrl(bookData.volumeInfo)
        });

        updateShelf(shelfKey);
        saveLibrary();
    }
}

// Update shelf display function: remove JS-based truncation to let CSS handle text overflow
function updateShelf(shelfKey) {
    const shelf = shelves[shelfKey];
    shelf.innerHTML = library[shelfKey].map(book => `
        <div class="book-item" draggable="true" data-book-id="${book.id}">
            <img src="${book.cover || 'https://via.placeholder.com/40x60'}" alt="${book.title}">
            <div class="book-info">
                <strong>${book.title}</strong>
                <small>${book.author}</small>
            </div>
            <button class="remove-btn btn" onclick="removeBook('${book.id}', '${shelfKey}')" title="Remove">
                <i class="fas fa-xmark"></i>
            </button>
        </div>
    `).join('');

    counters[shelfKey].textContent = `${library[shelfKey].length} books`;
    setupDragAndDrop();
}

// Update all shelves
function updateAllShelves() {
    Object.keys(shelves).forEach(updateShelf);
}

// Setup drag and drop
function setupDragAndDrop() {
    const bookItems = document.querySelectorAll('.book-item');
    bookItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });

    // Change: Add event listeners to shelf containers instead of book lists
    document.querySelectorAll('.shelf').forEach(shelf => {
        shelf.addEventListener('dragover', handleDragOver);
        shelf.addEventListener('dragleave', handleDragLeave);
        shelf.addEventListener('drop', handleDrop);
    });
}

// Updated drag and drop handlers
function handleDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.setData('text/plain', e.target.dataset.bookId);
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    // Remove drop zone highlighting
    document.querySelectorAll('.book-list').forEach(list => {
        list.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Add visual feedback for drop zone to the book-list inside the shelf
    const bookList = e.currentTarget.querySelector('.book-list');
    bookList.classList.add('drag-over');
}

function handleDragLeave(e) {
    // Only remove highlight if we're leaving the shelf entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
        const bookList = e.currentTarget.querySelector('.book-list');
        bookList.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    const bookId = e.dataTransfer.getData('text/plain');
    const targetShelf = e.currentTarget.id;
    const targetShelfKey = targetShelf === 'to-read' ? 'toRead' :
        targetShelf === 'reading' ? 'reading' : 'completed';

    moveBookToShelf(bookId, targetShelfKey);

    // Remove drop zone highlighting from all book lists
    document.querySelectorAll('.book-list').forEach(list => {
        list.classList.remove('drag-over');
    });
}

// Move book between shelves
function moveBookToShelf(bookId, targetShelfKey) {
    const sourceShelfKey = Object.keys(library).find(key =>
        library[key].some(book => book.id === bookId)
    );

    if (sourceShelfKey === targetShelfKey) return;

    const bookIndex = library[sourceShelfKey].findIndex(book => book.id === bookId);
    const [book] = library[sourceShelfKey].splice(bookIndex, 1);
    library[targetShelfKey].push(book);

    updateShelf(sourceShelfKey);
    updateShelf(targetShelfKey);
    saveLibrary();
}

// Remove book from shelf
function removeBook(bookId, shelfKey) {
    library[shelfKey] = library[shelfKey].filter(book => book.id !== bookId);
    updateShelf(shelfKey);
    saveLibrary();
}

// Save library to localStorage
function saveLibrary() {
    localStorage.setItem('library', JSON.stringify(library));
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function fetchVolume(bookId) {
    try {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes/${bookId}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching volume:', error);
        return null;
    }
}

// Initialize the app
init();