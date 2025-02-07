// Get references to DOM elements
const recommendationList = document.getElementById('recommendation-list');
const genreSelector = document.getElementById('genre-selector');
const reloadBtn = document.getElementById('reload-suggestions');
const searchBar = document.getElementById('search-bar');
const searchResults = document.getElementById('search-results');
const shelfSelector = document.getElementById('shelf-selector');
const addToShelfButton = document.getElementById('add-to-shelf-button');
const scrollLeftBtn = document.querySelector('.scroll-btn.left');
const scrollRightBtn = document.querySelector('.scroll-btn.right');

// Define shelves and counters
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

// Initialize variables
let selectedBook = null;
let library = JSON.parse(localStorage.getItem('library')) || {
    toRead: [],
    reading: [],
    completed: []
};

// Function to truncate text
function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '…' : text;
}

// Initialize the application
async function init() {
    setupEventListeners();
    await fetchRecommendations();
    updateAllShelves();
}

// Setup event listeners for various actions
function setupEventListeners() {
    reloadBtn.addEventListener('click', fetchRecommendations);
    genreSelector.addEventListener('change', () => {
        fetchRecommendations();
    });
    scrollLeftBtn.addEventListener('click', () => scrollRecommendations('left'));
    scrollRightBtn.addEventListener('click', () => scrollRecommendations('right'));
    searchBar.addEventListener('input', debounce(handleSearch, 300));
    addToShelfButton.addEventListener('click', handleAddToShelf);
    setupDragAndDrop();
    
    // Replace the previous blur listener with both blur and focus handlers
    searchBar.addEventListener('blur', (e) => {
        setTimeout(() => {
            searchResults.classList.remove('active');
        }, 200);
    });

    searchBar.addEventListener('focus', (e) => {
        if (searchBar.value.trim().length >= 1) {
            handleSearch(e);
        }
    });
}

// Fetch book recommendations from the Google Books API
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
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<p>Loading...</p>';
    document.querySelector('.suggestions-container').appendChild(loadingOverlay);
    try {
        const randomOffset = Math.floor(Math.random() * 100);
        const response = await fetch(
            `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=12&startIndex=${randomOffset}&orderBy=relevance&langRestrict=en`
        );
        const data = await response.json();
        if (data.items) {
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

// Get a random search query for diverse recommendations
function getRandomSearchQuery() {
    const queries = [
        'bestseller', 'award winning', 'popular', 'classic literature',
        'contemporary', 'highly rated', 'recommended reading', 'top rated',
        'must read', 'trending', 'notable', 'critically acclaimed',
        'blockbuster', 'celebrated', 'distinguished', 'remarkable'
    ];
    return queries[Math.floor(Math.random() * queries.length)];
}

// Get a secure image URL for the book cover
function getSecureImageUrl(volumeInfo) {
    if (!volumeInfo.imageLinks) {
        return 'https://via.placeholder.com/128x192?text=No+Cover';
    }
    const imageUrl = (volumeInfo.imageLinks.thumbnail || volumeInfo.imageLinks.smallThumbnail || '')
        .replace('http://', 'https://');
    return imageUrl || 'https://via.placeholder.com/128x192?text=No+Cover';
}

// Display book recommendations in the UI
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

// Scroll the recommendations horizontally
function scrollRecommendations(direction) {
    const scrollAmount = (180 + 32) * 2;
    recommendationList.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
    });
}

// Handle the search input and display search results
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

// Display search results in the UI
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

// Select a search result and populate the search bar
async function selectSearchResult(bookId) {
    const bookData = await fetchVolume(bookId);
    if (!bookData) return;
    selectedBook = bookData;
    searchBar.value = selectedBook.volumeInfo.title;
    searchResults.classList.remove('active');
    addToShelfButton.disabled = false;
    addToShelfButton.classList.add('active');
}

// Handle adding a book to a shelf
function handleAddToShelf() {
    if (!selectedBook) return;
    const shelfKey = shelfSelector.value;
    addBookToShelf(selectedBook.id, shelfKey);
    searchBar.value = '';
    selectedBook = null;
    addToShelfButton.disabled = true;
    addToShelfButton.classList.remove('active');
}

// Add a book to a specific shelf
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

// Update the UI for a specific shelf
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

// Update all shelves in the UI
function updateAllShelves() {
    Object.keys(shelves).forEach(updateShelf);
}

// Setup drag and drop functionality for book items
function setupDragAndDrop() {
    const bookItems = document.querySelectorAll('.book-item');
    bookItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });
    document.querySelectorAll('.shelf').forEach(shelf => {
        shelf.addEventListener('dragover', handleDragOver);
        shelf.addEventListener('dragleave', handleDragLeave);
        shelf.addEventListener('drop', handleDrop);
    });
}

// Handle the start of a drag event
function handleDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.setData('text/plain', e.target.dataset.bookId);
    e.dataTransfer.effectAllowed = 'move';
}

// Handle the end of a drag event
function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.book-list').forEach(list => {
        list.classList.remove('drag-over');
    });
}

// Handle the drag over event
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const bookList = e.currentTarget.querySelector('.book-list');
    bookList.classList.add('drag-over');
}

// Handle the drag leave event
function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
        const bookList = e.currentTarget.querySelector('.book-list');
        bookList.classList.remove('drag-over');
    }
}

// Handle the drop event
function handleDrop(e) {
    e.preventDefault();
    const bookId = e.dataTransfer.getData('text/plain');
    const targetShelf = e.currentTarget.id;
    const targetShelfKey = targetShelf === 'to-read' ? 'toRead' :
        targetShelf === 'reading' ? 'reading' : 'completed';
    moveBookToShelf(bookId, targetShelfKey);
    document.querySelectorAll('.book-list').forEach(list => {
        list.classList.remove('drag-over');
    });
}

// Move a book to a different shelf
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

// Remove a book from a shelf
function removeBook(bookId, shelfKey) {
    library[shelfKey] = library[shelfKey].filter(book => book.id !== bookId);
    updateShelf(shelfKey);
    saveLibrary();
}

// Save the library to local storage
function saveLibrary() {
    localStorage.setItem('library', JSON.stringify(library));
}

// Debounce function to limit the rate of function execution
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

// Fetch book volume data from the Google Books API
async function fetchVolume(bookId) {
    try {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes/${bookId}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching volume:', error);
        return null;
    }
}

// Initialize the application
init();