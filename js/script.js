// Initialize Lucide Icons
console.log("StudyHub script loading...");
lucide.createIcons();

// Gemini API Integration
import { GoogleGenAI } from "@google/genai";

// Fallback for environment variables in static hosting
const getEnv = (key) => {
    try {
        // Try localStorage first (user-provided override)
        const localValue = localStorage.getItem(`STUDYHUB_${key}`);
        if (localValue) return localValue;

        // Try Vite's import.meta.env
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
            return import.meta.env[key];
        }
        // Try process.env (for some build tools)
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            return process.env[key];
        }
    } catch (e) {}
    return null;
};

const GEMINI_API_KEY = getEnv('VITE_GEMINI_API_KEY') || getEnv('GEMINI_API_KEY') || 'YOUR_GEMINI_API_KEY_HERE';
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Supabase Configuration
const SUPABASE_URL = 'https://arqkzpnqfceqzrymzrnf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFycWt6cG5xZmNlcXpyeW16cm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTI1MzgsImV4cCI6MjA4ODI2ODUzOH0.XIBiWsg1oUcvlxmPXacA5pRWmDL6CgWku3r6CbDuk8Y';
let supabaseClient = null;

try {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase initialized successfully");
    } else {
        console.warn("Supabase library not found, running in local-only mode");
    }
} catch (e) {
    console.error("Supabase initialization failed", e);
}

// State
let resources = [];
let folders = [];
let newsItems = [];
let currentFolderId = null;
let activeInputMode = 'url'; // 'url' or 'file'
let contextMenuItem = null; // Stores the item currently targeted by context menu
let currentNewsFilter = 'all';
let studyTimerInterval = null;
let studyTimeRemaining = 0; // in seconds

// DOM Elements
const newsFeed = document.getElementById('news-feed');
const insightText = document.getElementById('insight-text');
const refreshInsightBtn = document.getElementById('refresh-insight');
const timerDisplay = document.getElementById('timer-display');
const timerToggle = document.getElementById('timer-toggle');
const timerReset = document.getElementById('timer-reset');
const resourceGallery = document.getElementById('resource-gallery');
const chatWidget = document.getElementById('chat-widget');
const openChatBtn = document.getElementById('open-chat');
const closeChatBtn = document.getElementById('close-chat');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat');
const chatMessages = document.getElementById('chat-messages');

const quickAddToggle = document.getElementById('quick-add-toggle');
const quickAddMenu = document.getElementById('quick-add-menu');
const addModal = document.getElementById('add-modal');
const folderModal = document.getElementById('folder-modal');
const moveModal = document.getElementById('move-modal');
const newsModal = document.getElementById('news-modal');
const deleteModal = document.getElementById('delete-modal');
const addResourceForm = document.getElementById('add-resource-form');
const addFolderForm = document.getElementById('add-folder-form');

const resTypeSelect = document.getElementById('res-type');
const customTypeContainer = document.getElementById('custom-type-container');
const toggleUrlBtn = document.getElementById('toggle-url');
const toggleFileBtn = document.getElementById('toggle-file');
const urlInputContainer = document.getElementById('url-input-container');
const fileInputContainer = document.getElementById('file-input-container');
const resFileInput = document.getElementById('res-file');
const fileNameDisplay = document.getElementById('file-name-display');
const toastContainer = document.getElementById('toast-container');
const breadcrumbsContainer = document.getElementById('breadcrumbs');
const contextMenu = document.getElementById('context-menu');

const driveViewerModal = document.getElementById('drive-viewer-modal');
const driveIframe = document.getElementById('drive-iframe');
const viewerTitle = document.getElementById('viewer-title');
const viewerLoader = document.getElementById('viewer-loader');
const viewerExternal = document.getElementById('viewer-external');

function saveNewsKeyFromUI() {
    const input = document.getElementById('news-api-key-input');
    const key = input.value.trim();
    if (key) {
        window.setNewsApiKey(key);
    } else {
        showToast("Please enter a valid key", "alert-circle");
    }
}

// Functions
function showToast(message, icon = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <i data-lucide="${icon}" class="w-4 h-4"></i>
        <span>${message}</span>
    `;
    toastContainer.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast("Copied to clipboard!", "check-circle");
    } catch (err) {
        console.error('Failed to copy: ', err);
    }
}

// Modal Handlers
function openModal() {
    addModal.classList.add('active');
    quickAddMenu.classList.remove('active');
}

function closeModal() {
    addModal.classList.remove('active');
    addResourceForm.reset();
    document.getElementById('modal-title').textContent = 'Add New Resource';
    document.getElementById('submit-btn-text').textContent = 'Save Resource';
    customTypeContainer.classList.add('hidden');
    setInputMode('url');
    fileNameDisplay.classList.add('hidden');
    contextMenuItem = null;
}

function openFolderModal() {
    folderModal.classList.add('active');
    quickAddMenu.classList.remove('active');
}

function closeFolderModal() {
    folderModal.classList.remove('active');
    addFolderForm.reset();
}

function openMoveModal(item) {
    contextMenuItem = item;
    moveModal.classList.add('active');
    renderFolderListForMove();
}

function closeMoveModal() {
    moveModal.classList.remove('active');
    contextMenuItem = null;
}

function openOfflineModal(path) {
    const modal = document.getElementById('offline-modal');
    const input = document.getElementById('offline-path-input');
    input.value = path;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeOfflineModal() {
    const modal = document.getElementById('offline-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function openNewsModal() {
    newsModal.classList.add('active');
    fetchNews();
}

function closeNewsModal() {
    newsModal.classList.remove('active');
}

const NEWS_API_KEY = getEnv('VITE_NEWS_API_KEY') || getEnv('NEWS_API_KEY');

async function fetchNews() {
    const newsFeed = document.getElementById('news-feed');
    
    // Show loading state
    newsFeed.innerHTML = `
        <div class="flex flex-col items-center justify-center py-40">
            <div class="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
    `;

    if (!NEWS_API_KEY || NEWS_API_KEY === 'YOUR_NEWS_API_KEY_HERE') {
        newsFeed.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
                <div class="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-2">
                    <i data-lucide="key" class="w-8 h-8 text-amber-500"></i>
                </div>
                <h3 class="text-lg font-bold text-slate-200">API Key Required</h3>
                <p class="text-slate-500 text-sm max-w-xs">To see real-time news, you need a free API key from <a href="https://gnews.io/" target="_blank" class="text-indigo-400 hover:underline font-medium">GNews.io</a>.</p>
                
                <div class="mt-6 w-full max-w-xs space-y-3">
                    <div class="relative">
                        <input type="password" id="news-api-key-input" placeholder="Paste your GNews API key here..." 
                            class="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                    </div>
                    <button onclick="saveNewsKeyFromUI()" class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]">
                        Save & Refresh
                    </button>
                </div>

                <div class="mt-8 pt-6 border-t border-slate-800/50 w-full max-w-xs">
                    <p class="text-[10px] uppercase font-black text-slate-500 mb-2 tracking-wider">Developer Option</p>
                    <code class="text-[11px] text-indigo-400/70 break-all bg-slate-900/50 p-2 rounded-lg block">setNewsApiKey('YOUR_KEY')</code>
                </div>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    // Map categories to GNews queries
    let query = 'technology';
    if (currentNewsFilter === 'cybersecurity') query = 'cybersecurity';
    else if (currentNewsFilter === 'ai') query = '"artificial intelligence"';
    else if (currentNewsFilter === 'hyderabad') query = 'hyderabad';
    else if (currentNewsFilter === 'jobs') query = '"tech jobs"';
    else if (currentNewsFilter === 'tech') query = 'technology';

    // Use proxy in development/production server, direct call for static hosting (GitHub Pages)
    const isStaticHost = window.location.hostname.includes('github.io') || 
                        window.location.hostname.includes('github.com') || 
                        window.location.protocol === 'file:';
    
    const url = isStaticHost 
        ? `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=15&apikey=${NEWS_API_KEY}`
        : `/api/news?q=${encodeURIComponent(query)}&apikey=${NEWS_API_KEY || ''}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.errors ? data.errors[0] : "API limit reached or invalid key");
        }
        newsItems = data.articles.map((article, index) => ({
            id: `news-${index}-${Date.now()}`,
            title: article.title,
            summary: article.description,
            category: currentNewsFilter,
            date: article.publishedAt,
            source: article.source.name,
            url: article.url,
            thumbnail: article.image
        }));
        
        // Update Breaking News Ticker
        const ticker = document.getElementById('breaking-news-ticker');
        if (ticker && newsItems.length > 0) {
            ticker.textContent = newsItems.map(item => item.title).join(' • ');
        }
        
        renderNews();
    } catch (err) {
        console.error("News API Error:", err);
        newsFeed.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 gap-4">
                <div class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
                    <i data-lucide="alert-triangle" class="w-8 h-8 text-red-500"></i>
                </div>
                <h3 class="text-lg font-bold text-slate-200">Feed Unavailable</h3>
                <p class="text-slate-500 text-sm text-center max-w-xs">${err.message || "Could not connect to the news service."}</p>
                <button onclick="fetchNews()" class="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all flex items-center gap-2">
                    <i data-lucide="refresh-cw" class="w-4 h-4"></i> Try Again
                </button>
            </div>
        `;
        lucide.createIcons();
    }
}

function renderNews() {
    const newsFeed = document.getElementById('news-feed');
    newsFeed.innerHTML = '';
    
    const filtered = currentNewsFilter === 'all' 
        ? newsItems 
        : newsItems.filter(item => item.category === currentNewsFilter);

    if (filtered.length === 0) {
        newsFeed.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 gap-4">
                <div class="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center opacity-50">
                    <i data-lucide="inbox" class="w-8 h-8 text-slate-500"></i>
                </div>
                <p class="text-slate-500 font-medium">No reports found in this category.</p>
            </div>
        `;
        return;
    }

    // Editorial Header for the list
    const sectionHeader = document.createElement('div');
    sectionHeader.className = 'flex items-center justify-between mb-2 px-2';
    sectionHeader.innerHTML = `
        <span class="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Latest Reports</span>
        <span class="text-[10px] font-bold text-slate-500 italic">Showing ${filtered.length} stories</span>
    `;
    newsFeed.appendChild(sectionHeader);

    filtered.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'group relative bg-slate-800/20 hover:bg-slate-800/40 border-b border-slate-800/50 last:border-0 transition-all duration-300 animate-fade-in';
        card.style.animationDelay = `${index * 0.05}s`;
        
        const dateObj = new Date(item.date);
        const timeAgo = formatTimeAgo(dateObj);
        
        // Validate URLs
        const isValidArticleUrl = item.url && item.url.startsWith('http');
        const articleUrl = isValidArticleUrl ? item.url : '#';
        const thumbnail = item.thumbnail && item.thumbnail.startsWith('http') ? item.thumbnail : `https://picsum.photos/seed/${item.id}/600/400`;

        card.innerHTML = `
            <div class="flex flex-col md:flex-row gap-6 py-8 px-2">
                <!-- Thumbnail with Editorial Overlay -->
                <div class="w-full md:w-64 h-44 shrink-0 relative rounded-xl overflow-hidden shadow-2xl bg-slate-800">
                    <img src="${thumbnail}" 
                         onerror="this.onerror=null; this.src='https://picsum.photos/seed/${item.id}/600/400';" 
                         alt="${item.title}" 
                         class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" 
                         referrerPolicy="no-referrer">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-60"></div>
                    <div class="absolute top-3 left-3">
                        <span class="px-2 py-1 bg-indigo-600 text-white rounded text-[9px] font-black uppercase tracking-widest shadow-xl">${item.category}</span>
                    </div>
                </div>
                
                <!-- Content -->
                <div class="flex-1 flex flex-col">
                    <div class="flex items-center gap-3 mb-3">
                        <span class="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">${item.source}</span>
                        <div class="w-1 h-1 bg-slate-700 rounded-full"></div>
                        <span class="text-[10px] text-slate-500 font-bold">${timeAgo}</span>
                    </div>
                    
                    <h4 class="text-xl font-bold text-slate-100 mb-3 leading-tight group-hover:text-indigo-400 transition-colors">
                        <a href="${articleUrl}" target="_blank" class="hover:underline decoration-indigo-500/30 underline-offset-4">${item.title}</a>
                    </h4>
                    
                    <p class="text-sm text-slate-400 leading-relaxed mb-6 line-clamp-2 font-medium italic opacity-80">
                        ${item.summary}
                    </p>
                    
                    <div class="mt-auto flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <button class="text-slate-500 hover:text-indigo-400 transition-colors">
                                <i data-lucide="bookmark" class="w-4 h-4"></i>
                            </button>
                            <button class="text-slate-500 hover:text-indigo-400 transition-colors">
                                <i data-lucide="share-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                        <a href="${articleUrl}" target="_blank" class="group/btn inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-white transition-all ${!isValidArticleUrl ? 'pointer-events-none opacity-50' : ''}">
                            Full Coverage 
                            <i data-lucide="arrow-right" class="w-3 h-3 group-hover/btn:translate-x-1 transition-transform"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
        newsFeed.appendChild(card);
    });
    
    lucide.createIcons();
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + "h ago";
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + "m ago";
    return "Just now";
}

window.filterNews = (category) => {
    if (currentNewsFilter === category) return;
    currentNewsFilter = category;
    document.querySelectorAll('.news-tab').forEach(tab => {
        tab.classList.remove('active', 'bg-indigo-600', 'text-white');
        tab.classList.add('text-slate-500');
        const tabLabel = tab.textContent.toLowerCase().trim();
        const categoryLabel = category.toLowerCase().trim();
        if (tabLabel === categoryLabel || (category === 'all' && tabLabel === 'all')) {
            tab.classList.add('active', 'bg-indigo-600', 'text-white');
            tab.classList.remove('text-slate-500');
        }
    });
    fetchNews();
};

function openDriveViewer(url, title) {
    viewerTitle.textContent = title;
    viewerLoader.style.display = 'flex';
    driveViewerModal.classList.remove('hidden');
    driveViewerModal.classList.add('flex');
    
    // Convert view URL to preview URL for embedding
    let previewUrl = url;
    if (url.includes('drive.google.com')) {
        if (url.includes('/view')) {
            previewUrl = url.replace('/view', '/preview');
        } else if (!url.includes('/preview')) {
            // Try to append preview if it's a direct link
            if (url.endsWith('/')) previewUrl += 'preview';
            else previewUrl += '/preview';
        }
    }
    
    driveIframe.src = previewUrl;
    viewerExternal.onclick = () => window.open(url, '_blank');
    
    driveIframe.onload = () => {
        viewerLoader.style.display = 'none';
    };
}

function closeDriveViewer() {
    driveViewerModal.classList.add('hidden');
    driveViewerModal.classList.remove('flex');
    driveIframe.src = '';
}

function openDeleteModal(item) {
    contextMenuItem = item;
    document.getElementById('delete-item-name').textContent = item.name || item.title;
    deleteModal.classList.add('active');
}

function closeDeleteModal() {
    deleteModal.classList.remove('active');
    contextMenuItem = null;
}

function copyOfflinePath() {
    const input = document.getElementById('offline-path-input');
    copyToClipboard(input.value);
}

// Data Fetching
async function fetchResources() {
    // Try to load from localStorage first for instant UI
    try {
        const cachedResources = localStorage.getItem('studyhub_resources');
        const cachedFolders = localStorage.getItem('studyhub_folders');
        if (cachedResources) resources = JSON.parse(cachedResources);
        if (cachedFolders) folders = JSON.parse(cachedFolders);
    } catch (e) {
        console.warn("Failed to parse local data:", e);
    }
    
    renderResources();
    renderBreadcrumbs();

    if (!supabaseClient) return;

    try {
        // Fetch Folders from Supabase
        let folderQuery = supabaseClient.from('folders').select('*');
        if (currentFolderId) {
            folderQuery = folderQuery.eq('parent_id', currentFolderId);
        } else {
            folderQuery = folderQuery.is('parent_id', null);
        }
        const { data: fData, error: fErr } = await folderQuery.order('name', { ascending: true });

        // Fetch Resources from Supabase
        let resourceQuery = supabaseClient.from('resources').select('*');
        if (currentFolderId) {
            resourceQuery = resourceQuery.eq('folder_id', currentFolderId);
        } else {
            resourceQuery = resourceQuery.is('folder_id', null);
        }
        const { data: rData, error: rErr } = await resourceQuery.order('created_at', { ascending: false });

        if (fErr && fErr.code !== 'PGRST116' && fErr.code !== '42P01') throw fErr;
        if (rErr && rErr.code !== '42P01') throw rErr;
        
        if (fData) {
            folders = fData;
            localStorage.setItem('studyhub_folders', JSON.stringify(folders));
        }
        if (rData) {
            resources = rData;
            localStorage.setItem('studyhub_resources', JSON.stringify(resources));
        }
        
        renderResources();
        renderBreadcrumbs();
    } catch (err) {
        console.warn("Supabase fetch failed, using local data:", err);
        // We already rendered local data above, so just log the warning
    }
}

// Rendering
function getResourceIcon(type) {
    switch (type) {
        case 'Book': return 'book';
        case 'Video': return 'play-circle';
        case 'Website': return 'globe';
        case 'PDF': return 'file-text';
        default: return 'box';
    }
}

function renderResources() {
    resourceGallery.innerHTML = '';

    if (folders.length === 0 && resources.length === 0) {
        resourceGallery.innerHTML = '<p class="col-span-full text-center text-slate-500 py-10">This folder is empty.</p>';
        return;
    }

    // Render Folders
    folders.forEach((folder, index) => {
        const folderEl = document.createElement('div');
        folderEl.className = 'resource-card group relative bg-[#1e293b] rounded-2xl border border-slate-800 p-4 hover:border-indigo-500 transition-all cursor-pointer animate-fade-in';
        folderEl.style.animationDelay = `${index * 0.05}s`;
        folderEl.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-400">
                    <i data-lucide="folder" class="w-6 h-6 fill-current"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="font-bold text-slate-200 truncate">${folder.name}</h3>
                    <p class="text-[10px] text-slate-500 truncate">${folder.description || 'Folder'}</p>
                </div>
                <button class="more-btn p-2 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800 transition-colors relative z-10">
                    <i data-lucide="more-vertical" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        
        folderEl.addEventListener('click', (e) => {
            if (e.target.closest('.more-btn')) {
                e.stopPropagation();
                showContextMenu(e, folder, 'folder');
            } else {
                navigateToFolder(folder.id);
            }
        });
        
        resourceGallery.appendChild(folderEl);
    });

    // Render Resources
    resources.forEach((res, index) => {
        const resEl = document.createElement('div');
        resEl.className = 'resource-card group relative bg-[#1e293b] rounded-2xl border border-slate-800 p-4 hover:border-indigo-500 transition-all cursor-pointer animate-fade-in';
        resEl.style.animationDelay = `${(folders.length + index) * 0.05}s`;
        
        const icon = getResourceIcon(res.type);
        const displayUrl = res.link_url || '#';
        const isOffline = res.is_offline;
        const isGoogleDrive = res.is_google_drive;
        
        resEl.innerHTML = `
            <div class="flex items-start gap-4">
                <div class="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-400 transition-colors">
                    <i data-lucide="${icon}" class="w-6 h-6"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                        <h3 class="font-bold text-slate-200 truncate">${res.title}</h3>
                        <button class="more-btn p-1 text-slate-500 hover:text-white rounded transition-colors relative z-10">
                            <i data-lucide="more-vertical" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <p class="text-xs text-slate-500 truncate mb-2">${res.author || 'Unknown'}</p>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-bold text-indigo-400 flex items-center gap-1">
                            <i data-lucide="${isOffline ? 'hard-drive' : (isGoogleDrive ? 'file-text' : 'external-link')}" class="w-3 h-3"></i>
                            ${isOffline ? 'View Path' : (isGoogleDrive ? 'View in App' : 'Open')}
                        </span>
                        <span class="text-[10px] text-slate-600">•</span>
                        <span class="text-[10px] text-slate-500">${res.type}</span>
                    </div>
                </div>
            </div>
        `;

        resEl.addEventListener('click', (e) => {
            if (e.target.closest('.more-btn')) {
                e.stopPropagation();
                showContextMenu(e, res, 'resource');
            } else {
                if (isOffline) {
                    openOfflineModal(res.link_url);
                } else if (isGoogleDrive) {
                    openDriveViewer(res.link_url, res.title);
                } else {
                    window.open(displayUrl, '_blank');
                }
            }
        });

        resourceGallery.appendChild(resEl);
    });

    lucide.createIcons();
}

async function renderBreadcrumbs() {
    breadcrumbsContainer.innerHTML = `
        <button onclick="navigateToFolder(null)" class="hover:text-indigo-400 flex items-center gap-1">
            <i data-lucide="home" class="w-3 h-3"></i>
            Root
        </button>
    `;

    if (currentFolderId) {
        try {
            // In a real app, you'd fetch the full path. Here we just show the current folder name for simplicity
            const { data: folder } = await supabaseClient.from('folders').select('name').eq('id', currentFolderId).single();
            if (folder) {
                breadcrumbsContainer.innerHTML += `
                    <i data-lucide="chevron-right" class="w-3 h-3"></i>
                    <span class="text-slate-300 font-medium">${folder.name}</span>
                `;
            }
        } catch (err) {
            console.error(err);
        }
    }
    lucide.createIcons();
}

function navigateToFolder(id) {
    currentFolderId = id;
    fetchResources();
}

// Context Menu Logic
function showContextMenu(e, item, type) {
    contextMenuItem = { ...item, itemType: type };
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.top = `${e.clientY}px`;
    
    // Adjust position if it goes off screen
    const menuRect = contextMenu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
        contextMenu.style.left = `${e.clientX - menuRect.width}px`;
    }
    if (menuRect.bottom > window.innerHeight) {
        contextMenu.style.top = `${e.clientY - menuRect.height}px`;
    }
}

function hideContextMenu() {
    contextMenu.style.display = 'none';
}

// Actions
async function deleteItem() {
    if (!contextMenuItem) return;
    const { id, itemType } = contextMenuItem;

    try {
        if (supabaseClient) {
            const table = itemType === 'folder' ? 'folders' : 'resources';
            const { error } = await supabaseClient.from(table).delete().eq('id', id);
            if (error) throw error;
        } else {
            // Local fallback
            if (itemType === 'folder') {
                folders = folders.filter(f => f.id !== id);
                localStorage.setItem('studyhub_folders', JSON.stringify(folders));
            } else {
                resources = resources.filter(r => r.id !== id);
                localStorage.setItem('studyhub_resources', JSON.stringify(resources));
            }
        }
        
        showToast(`Deleted ${itemType}`, "trash-2");
        fetchResources();
    } catch (err) {
        console.error("Delete operation failed:", err);
        showToast(`Delete failed: ${err.message || 'Unknown error'}`, "alert-circle");
    } finally {
        closeDeleteModal();
    }
}

async function renderFolderListForMove() {
    const listContainer = document.getElementById('folder-list-move');
    listContainer.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Loading folders...</p>';
    
    try {
        let allFolders = [];
        if (supabaseClient) {
            const { data, error } = await supabaseClient.from('folders').select('*').order('name', { ascending: true });
            if (error) throw error;
            allFolders = data || [];
        } else {
            allFolders = folders;
        }

        listContainer.innerHTML = `
            <button onclick="selectFolderForMove(null)" class="w-full text-left px-4 py-3 rounded-xl border border-slate-800 hover:border-indigo-500 transition-all flex items-center gap-3 bg-slate-900/50 mb-2">
                <i data-lucide="home" class="w-4 h-4 text-slate-500"></i>
                <span class="text-sm text-slate-300">Root Directory</span>
            </button>
        `;

        const buildTree = (parentId, container) => {
            const children = (allFolders || []).filter(f => f.parent_id === parentId);
            children.forEach(f => {
                if (contextMenuItem.itemType === 'folder' && f.id === contextMenuItem.id) return;
                
                const itemWrapper = document.createElement('div');
                itemWrapper.className = 'mb-1';
                
                const btnWrapper = document.createElement('div');
                btnWrapper.className = 'flex items-center gap-1';
                
                const hasChildren = allFolders.some(child => child.parent_id === f.id);
                
                if (hasChildren) {
                    const toggle = document.createElement('button');
                    toggle.className = 'p-1 hover:bg-slate-800 rounded text-slate-500 tree-toggle';
                    toggle.innerHTML = '<i data-lucide="chevron-right" class="w-4 h-4"></i>';
                    toggle.onclick = (e) => {
                        e.stopPropagation();
                        const childContainer = itemWrapper.querySelector('.tree-node');
                        childContainer.classList.toggle('expanded');
                        toggle.classList.toggle('expanded');
                    };
                    btnWrapper.appendChild(toggle);
                } else {
                    const spacer = document.createElement('div');
                    spacer.className = 'w-6';
                    btnWrapper.appendChild(spacer);
                }

                const btn = document.createElement('button');
                btn.onclick = () => selectFolderForMove(f.id);
                btn.className = 'flex-1 text-left px-4 py-2 rounded-xl border border-slate-800 hover:border-indigo-500 transition-all flex items-center gap-3 bg-slate-900/50';
                btn.innerHTML = `
                    <i data-lucide="folder" class="w-4 h-4 text-indigo-400"></i>
                    <span class="text-sm text-slate-300">${f.name}</span>
                `;
                btnWrapper.appendChild(btn);
                itemWrapper.appendChild(btnWrapper);
                
                if (hasChildren) {
                    const childContainer = document.createElement('div');
                    childContainer.className = 'tree-node';
                    buildTree(f.id, childContainer);
                    itemWrapper.appendChild(childContainer);
                }
                
                container.appendChild(itemWrapper);
            });
        };

        buildTree(null, listContainer);
        lucide.createIcons();
    } catch (err) {
        console.error("Error rendering folder tree:", err);
        listContainer.innerHTML = '<p class="text-xs text-red-400 text-center py-4">Failed to load folders.</p>';
    }
}

let selectedFolderIdForMove = null;
window.selectFolderForMove = (id) => {
    selectedFolderIdForMove = id;
    // Highlight selection
    document.querySelectorAll('#folder-list-move button').forEach(btn => {
        btn.classList.remove('border-indigo-500', 'bg-indigo-500/10');
    });
    event.currentTarget.classList.add('border-indigo-500', 'bg-indigo-500/10');
};

async function confirmMove() {
    if (!contextMenuItem) return;
    
    try {
        const table = contextMenuItem.itemType === 'folder' ? 'folders' : 'resources';
        const column = contextMenuItem.itemType === 'folder' ? 'parent_id' : 'folder_id';
        
        if (supabaseClient) {
            const { error } = await supabaseClient.from(table).update({ [column]: selectedFolderIdForMove }).eq('id', contextMenuItem.id);
            if (error) throw error;
        } else {
            // Local fallback
            if (contextMenuItem.itemType === 'folder') {
                folders = folders.map(f => f.id === contextMenuItem.id ? { ...f, parent_id: selectedFolderIdForMove } : f);
                localStorage.setItem('studyhub_folders', JSON.stringify(folders));
            } else {
                resources = resources.map(r => r.id === contextMenuItem.id ? { ...r, folder_id: selectedFolderIdForMove } : r);
                localStorage.setItem('studyhub_resources', JSON.stringify(resources));
            }
        }
        
        showToast("Moved successfully", "folder-input");
        closeMoveModal();
        fetchResources();
    } catch (err) {
        console.error(err);
        showToast("Move failed", "alert-circle");
    }
}

// Form Submissions
async function handleResourceSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('res-title').value;
    let type = document.getElementById('res-type').value;
    if (type === 'Other') type = document.getElementById('res-custom-type').value || 'Other';
    const author = document.getElementById('res-author').value;
    const tags = document.getElementById('res-tags').value.split(',').map(t => t.trim()).filter(t => t);
    const isOffline = document.getElementById('res-offline').checked;
    const isGoogleDrive = document.getElementById('res-google-drive').checked;
    const url = document.getElementById('res-url').value;
    const file = resFileInput.files[0];

    const submitBtn = addResourceForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
    lucide.createIcons();

    let finalUrl = url;
    if (activeInputMode === 'file' && file && supabaseClient) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const { data, error } = await supabaseClient.storage.from('resources').upload(`uploads/${fileName}`, file);
            if (error) throw error;
            const { data: { publicUrl } } = supabaseClient.storage.from('resources').getPublicUrl(`uploads/${fileName}`);
            finalUrl = publicUrl;
        } catch (err) {
            console.error(err);
            showToast("Upload failed", "alert-circle");
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }
    }

    try {
        let error;
        if (supabaseClient) {
            if (contextMenuItem && contextMenuItem.id) {
                // Update existing
                ({ error } = await supabaseClient.from('resources').update({
                    title, type, author, tags, link_url: finalUrl, is_offline: isOffline, is_google_drive: isGoogleDrive
                }).eq('id', contextMenuItem.id));
            } else {
                // Insert new
                ({ error } = await supabaseClient.from('resources').insert([{
                    title, type, author, tags, link_url: finalUrl, is_offline: isOffline, is_google_drive: isGoogleDrive, folder_id: currentFolderId
                }]));
            }
            if (error) throw error;
        } else {
            // Local fallback
            const newRes = {
                id: contextMenuItem?.id || `local-${Date.now()}`,
                title, type, author, tags, link_url: finalUrl, is_offline: isOffline, is_google_drive: isGoogleDrive, folder_id: currentFolderId,
                created_at: new Date().toISOString()
            };
            if (contextMenuItem && contextMenuItem.id) {
                resources = resources.map(r => r.id === contextMenuItem.id ? newRes : r);
            } else {
                resources.push(newRes);
            }
            localStorage.setItem('studyhub_resources', JSON.stringify(resources));
        }
        
        showToast(contextMenuItem ? "Resource updated!" : "Resource added!", "check");
        closeModal();
        fetchResources();
    } catch (err) {
        console.error(err);
        showToast("Save failed", "alert-circle");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        lucide.createIcons();
    }
}

async function handleFolderSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('folder-name').value;
    const description = document.getElementById('folder-desc').value;

    try {
        if (supabaseClient) {
            const { error } = await supabaseClient.from('folders').insert([{
                name, description, parent_id: currentFolderId
            }]);
            if (error) throw error;
        } else {
            // Local fallback
            const newFolder = {
                id: `local-folder-${Date.now()}`,
                name, description, parent_id: currentFolderId,
                created_at: new Date().toISOString()
            };
            folders.push(newFolder);
            localStorage.setItem('studyhub_folders', JSON.stringify(folders));
        }
        showToast("Folder created!", "folder-plus");
        closeFolderModal();
        fetchResources();
    } catch (err) {
        console.error(err);
        showToast("Failed to create folder", "alert-circle");
    }
}

// Chat Logic
function addMessage(text, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex gap-2 ${isUser ? 'flex-row-reverse' : ''} animate-fade-in`;
    msgDiv.innerHTML = `
        <div class="w-8 h-8 rounded-lg ${isUser ? 'bg-slate-800' : 'bg-indigo-900/50'} flex items-center justify-center shrink-0">
            <i data-lucide="${isUser ? 'user' : 'bot'}" class="w-4 h-4 ${isUser ? 'text-slate-400' : 'text-indigo-400'}"></i>
        </div>
        <div class="${isUser ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-[#1e293b] text-slate-300 rounded-tl-none border border-slate-800'} p-3 rounded-2xl text-sm shadow-sm max-w-[80%]">
            ${text}
        </div>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    lucide.createIcons();
}

async function handleChat() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    addMessage(text, true);
    chatInput.value = '';
    
    // Create a placeholder for the bot response
    const botMsgDiv = document.createElement('div');
    botMsgDiv.className = `flex gap-2 animate-fade-in`;
    botMsgDiv.innerHTML = `
        <div class="w-8 h-8 rounded-lg bg-indigo-900/50 flex items-center justify-center shrink-0">
            <i data-lucide="bot" class="w-4 h-4 text-indigo-400"></i>
        </div>
        <div class="bg-[#1e293b] text-slate-300 rounded-2xl rounded-tl-none border border-slate-800 p-3 text-sm shadow-sm max-w-[80%] bot-content">
            <div class="flex items-center gap-2">
                <div class="w-1 h-1 bg-indigo-400 rounded-full animate-bounce"></div>
                <div class="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div class="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
        </div>
    `;
    chatMessages.appendChild(botMsgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    lucide.createIcons();

    const botContent = botMsgDiv.querySelector('.bot-content');

    try {
        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
            throw new Error("Gemini API Key is missing. Please set it in your environment.");
        }
        // Fetch ALL resources and folders for context
        let allRes = resources;
        let allFolders = folders;
        
        if (supabaseClient) {
            const { data: resData } = await supabaseClient.from('resources').select('*');
            const { data: folderData } = await supabaseClient.from('folders').select('*');
            if (resData) allRes = resData;
            if (folderData) allFolders = folderData;
        }
        
        const context = `
            You are a helpful Study Assistant for StudyHub. 
            You have access to the user's study resources and folders.
            
            Current Resources:
            ${(allRes || []).map(r => `- ${r.title} (${r.type}) by ${r.author || 'Unknown'}. Tags: ${(r.tags || []).join(', ')}`).join('\n')}
            
            Current Folders:
            ${(allFolders || []).map(f => `- ${f.name}: ${f.description || 'No description'}`).join('\n')}
            
            Answer the user's questions based on these resources. If they ask about a specific book or video, check if it exists in their library.
            Be concise and professional.
        `;

        const response = await ai.models.generateContentStream({
            model: "gemini-3.1-flash-lite-preview",
            contents: [{ role: 'user', parts: [{ text }] }],
            config: {
                systemInstruction: context
            }
        });

        botContent.innerHTML = '';
        let fullText = '';
        
        for await (const chunk of response) {
            const chunkText = chunk.text;
            fullText += chunkText;
            // Simple markdown-ish bolding for better readability
            botContent.innerHTML = fullText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    } catch (err) {
        console.error("Gemini Error:", err);
        botContent.innerHTML = "Sorry, I encountered an error while processing your request. Please check your connection and try again.";
    }
}

// Timer Logic
function updateTimerDisplay() {
    const minutes = Math.floor(studyTimeRemaining / 60);
    const seconds = studyTimeRemaining % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function toggleTimer() {
    if (studyTimerInterval) {
        // Stop
        clearInterval(studyTimerInterval);
        studyTimerInterval = null;
        timerToggle.textContent = 'Start';
        timerToggle.classList.replace('bg-red-600', 'bg-indigo-600');
        timerToggle.classList.replace('hover:bg-red-700', 'hover:bg-indigo-700');
    } else {
        // Start
        if (studyTimeRemaining <= 0) studyTimeRemaining = 25 * 60;
        timerToggle.textContent = 'Stop';
        timerToggle.classList.replace('bg-indigo-600', 'bg-red-600');
        timerToggle.classList.replace('hover:bg-indigo-700', 'hover:bg-red-700');
        
        studyTimerInterval = setInterval(() => {
            studyTimeRemaining--;
            updateTimerDisplay();
            if (studyTimeRemaining <= 0) {
                clearInterval(studyTimerInterval);
                studyTimerInterval = null;
                timerToggle.textContent = 'Start';
                timerToggle.classList.replace('bg-red-600', 'bg-indigo-600');
                showToast("Focus session complete! Take a break.", "coffee");
                // Play a subtle sound if possible or just visual feedback
            }
        }, 1000);
    }
}

function resetTimer() {
    clearInterval(studyTimerInterval);
    studyTimerInterval = null;
    studyTimeRemaining = 25 * 60;
    updateTimerDisplay();
    timerToggle.textContent = 'Start';
    timerToggle.classList.replace('bg-red-600', 'bg-indigo-600');
}

// Event Listeners
timerToggle.addEventListener('click', toggleTimer);
timerReset.addEventListener('click', resetTimer);

// Insight Logic
async function fetchDailyInsight() {
    insightText.classList.add('opacity-50');
    try {
        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
            throw new Error("API Key missing");
        }
        const prompt = "Generate a short, inspiring study tip or motivational quote for a student. Max 100 characters.";
        const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        if (response.text) {
            insightText.textContent = `"${response.text.trim()}"`;
        }
    } catch (err) {
        console.error("Insight Error:", err);
        insightText.textContent = '"The beautiful thing about learning is that no one can take it away from you."';
    } finally {
        insightText.classList.remove('opacity-50');
    }
}

// Event Listeners
refreshInsightBtn.addEventListener('click', fetchDailyInsight);

// Initialize Timer
studyTimeRemaining = 25 * 60;
updateTimerDisplay();
fetchDailyInsight();

quickAddToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    quickAddMenu.classList.toggle('active');
});

document.addEventListener('click', () => {
    quickAddMenu.classList.remove('active');
    hideContextMenu();
});

resTypeSelect.addEventListener('change', (e) => {
    customTypeContainer.classList.toggle('hidden', e.target.value !== 'Other');
});

toggleUrlBtn.addEventListener('click', () => setInputMode('url'));
toggleFileBtn.addEventListener('click', () => setInputMode('file'));

function setInputMode(mode) {
    activeInputMode = mode;
    toggleUrlBtn.className = mode === 'url' ? 'flex-1 py-2 text-xs font-bold rounded-lg bg-slate-800 shadow-sm text-indigo-400 transition-all' : 'flex-1 py-2 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-400 transition-all';
    toggleFileBtn.className = mode === 'file' ? 'flex-1 py-2 text-xs font-bold rounded-lg bg-slate-800 shadow-sm text-indigo-400 transition-all' : 'flex-1 py-2 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-400 transition-all';
    urlInputContainer.classList.toggle('hidden', mode !== 'url');
    fileInputContainer.classList.toggle('hidden', mode !== 'file');
}

resFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        fileNameDisplay.textContent = `Selected: ${e.target.files[0].name}`;
        fileNameDisplay.classList.remove('hidden');
    }
});

addResourceForm.addEventListener('submit', handleResourceSubmit);
addFolderForm.addEventListener('submit', handleFolderSubmit);
document.getElementById('confirm-move-btn').addEventListener('click', confirmMove);
document.getElementById('confirm-delete-btn').addEventListener('click', deleteItem);

document.getElementById('ctx-delete').addEventListener('click', () => {
    hideContextMenu();
    openDeleteModal(contextMenuItem);
});
document.getElementById('ctx-move').addEventListener('click', () => {
    hideContextMenu();
    openMoveModal(contextMenuItem);
});
document.getElementById('ctx-edit').addEventListener('click', async () => {
    if (!contextMenuItem) return;
    
    if (contextMenuItem.itemType === 'folder') {
        const oldName = contextMenuItem.name;
        const newName = prompt(`Rename folder "${oldName}" to:`, oldName);
        if (newName && newName !== oldName) {
            try {
                const { error } = await supabaseClient.from('folders').update({ name: newName }).eq('id', contextMenuItem.id);
                if (error) throw error;
                showToast("Folder renamed", "edit-3");
                fetchResources();
            } catch (err) {
                console.error(err);
                showToast("Rename failed", "alert-circle");
            }
        }
    } else {
        // Full edit for resource
        document.getElementById('modal-title').textContent = 'Edit Resource';
        document.getElementById('submit-btn-text').textContent = 'Update Resource';
        
        document.getElementById('res-title').value = contextMenuItem.title;
        document.getElementById('res-author').value = contextMenuItem.author || '';
        document.getElementById('res-tags').value = (contextMenuItem.tags || []).join(', ');
        document.getElementById('res-offline').checked = contextMenuItem.is_offline;
        document.getElementById('res-google-drive').checked = contextMenuItem.is_google_drive || false;
        document.getElementById('res-url').value = contextMenuItem.link_url || '';
        
        const typeSelect = document.getElementById('res-type');
        const standardTypes = ['Book', 'Video', 'Website', 'PDF'];
        if (standardTypes.includes(contextMenuItem.type)) {
            typeSelect.value = contextMenuItem.type;
            customTypeContainer.classList.add('hidden');
        } else {
            typeSelect.value = 'Other';
            customTypeContainer.classList.remove('hidden');
            document.getElementById('res-custom-type').value = contextMenuItem.type;
        }
        
        openModal();
    }
    hideContextMenu();
});

document.getElementById('open-news-btn').addEventListener('click', openNewsModal);
closeChatBtn.addEventListener('click', () => {
    chatWidget.classList.add('translate-y-full', 'opacity-0', 'pointer-events-none');
    openChatBtn.classList.remove('scale-0', 'opacity-0');
});

openChatBtn.addEventListener('click', () => {
    chatWidget.classList.remove('translate-y-full', 'opacity-0', 'pointer-events-none');
    openChatBtn.classList.add('scale-0', 'opacity-0');
});

sendChatBtn.addEventListener('click', handleChat);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleChat(); });

// Initialize
fetchResources();

// Expose navigation to window for breadcrumbs
window.navigateToFolder = navigateToFolder;
window.openModal = openModal;
window.closeModal = closeModal;
window.openFolderModal = openFolderModal;
window.closeFolderModal = closeFolderModal;
window.closeMoveModal = closeMoveModal;
window.closeNewsModal = closeNewsModal;
window.closeDeleteModal = closeDeleteModal;
window.closeDriveViewer = closeDriveViewer;
window.closeOfflineModal = closeOfflineModal;
window.copyOfflinePath = copyOfflinePath;
window.selectFolderForMove = selectFolderForMove;
window.fetchNews = fetchNews;
window.openNewsModal = openNewsModal;
window.filterNews = filterNews;
window.saveNewsKeyFromUI = saveNewsKeyFromUI;
