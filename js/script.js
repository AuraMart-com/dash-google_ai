// Initialize Lucide Icons
lucide.createIcons();

// Gemini API Integration
import { GoogleGenAI } from "@google/genai";

// Vite will replace process.env.GEMINI_API_KEY with the actual key during build/dev
let GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
try {
    // This string is replaced by Vite during build
    const envKey = process.env.GEMINI_API_KEY;
    if (envKey && envKey !== 'undefined') {
        GEMINI_API_KEY = envKey;
    }
} catch (e) {
    // process is not defined in browser
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Supabase Configuration
const SUPABASE_URL = 'https://arqkzpnqfceqzrymzrnf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFycWt6cG5xZmNlcXpyeW16cm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTI1MzgsImV4cCI6MjA4ODI2ODUzOH0.XIBiWsg1oUcvlxmPXacA5pRWmDL6CgWku3r6CbDuk8Y';
let supabaseClient = null;

try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase initialized successfully");
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

async function fetchNews() {
    const newsFeed = document.getElementById('news-feed');
    
    // Check if we have cached news that is not older than 6 hours
    const cachedNews = localStorage.getItem('studyhub_news');
    const lastFetch = localStorage.getItem('studyhub_news_timestamp');
    const now = Date.now();
    
    if (cachedNews && lastFetch && (now - lastFetch < 6 * 60 * 60 * 1000)) {
        newsItems = JSON.parse(cachedNews);
        // Filter out news older than 2 days
        newsItems = newsItems.filter(item => {
            const itemDate = new Date(item.date);
            const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);
            return itemDate > twoDaysAgo;
        });
        renderNews();
        return;
    }

    try {
        const prompt = `
            Generate 15 realistic news headlines and short summaries for a study dashboard.
            Topics to cover: Cybersecurity, Tech, Indian-Tech, Cybersecurity Jobs, AI/ML, AI technologies, Hyderabad tech, Hyderabad real-estate, Hyderabad businesses, Hyderabad investments.
            
            Return ONLY a JSON array of objects with these fields:
            - id: unique string
            - title: string
            - summary: string (max 150 chars)
            - category: one of [cybersecurity, tech, ai, hyderabad, jobs]
            - date: ISO date string (must be within the last 48 hours)
            - source: string (e.g. TechCrunch, Times of India, etc)
            - url: string (placeholder url)
            - thumbnail: string (a high-quality placeholder image URL from picsum.photos with a relevant seed)
        `;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json"
            }
        });

        let text = response.text;
        // Clean up the response if it contains markdown blocks
        if (text.includes('```json')) {
            text = text.split('```json')[1].split('```')[0].trim();
        } else if (text.includes('```')) {
            text = text.split('```')[1].split('```')[0].trim();
        }

        const data = JSON.parse(text);
        newsItems = data;
        
        // Cache it
        localStorage.setItem('studyhub_news', JSON.stringify(newsItems));
        localStorage.setItem('studyhub_news_timestamp', now.toString());
        
        renderNews();
    } catch (err) {
        console.error("News Fetch Error:", err);
        newsFeed.innerHTML = '<p class="col-span-full text-center text-red-400 py-10">Failed to load news. Please try again later.</p>';
    }
}

function renderNews() {
    const newsFeed = document.getElementById('news-feed');
    newsFeed.innerHTML = '';
    
    const filtered = currentNewsFilter === 'all' 
        ? newsItems 
        : newsItems.filter(item => item.category === currentNewsFilter);

    if (filtered.length === 0) {
        newsFeed.innerHTML = '<p class="col-span-full text-center text-slate-500 py-10">No news found in this category.</p>';
        return;
    }

    filtered.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden hover:border-indigo-500 transition-all group animate-fade-in flex flex-col md:flex-row';
        card.style.animationDelay = `${index * 0.1}s`;
        
        const dateObj = new Date(item.date);
        const timeAgo = formatTimeAgo(dateObj);
        const thumbnail = item.thumbnail || `https://picsum.photos/seed/${item.id}/400/250`;

        card.innerHTML = `
            <div class="w-full md:w-48 h-48 md:h-auto shrink-0 relative overflow-hidden">
                <img src="${thumbnail}" alt="${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer">
                <div class="absolute top-3 left-3">
                    <span class="px-2 py-1 bg-indigo-600/90 backdrop-blur-sm text-white rounded text-[10px] font-bold uppercase tracking-wider shadow-lg">${item.category}</span>
                </div>
            </div>
            <div class="flex-1 p-5 flex flex-col">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[10px] text-slate-500 font-bold italic">${item.source}</span>
                    <span class="text-[10px] text-slate-500 font-medium">${timeAgo}</span>
                </div>
                <h4 class="text-base font-bold text-slate-200 mb-2 group-hover:text-indigo-400 transition-colors line-clamp-2">${item.title}</h4>
                <p class="text-xs text-slate-400 mb-4 line-clamp-2 flex-1">${item.summary}</p>
                <div class="flex items-center justify-end mt-auto pt-4 border-t border-slate-700/50">
                    <a href="${item.url}" target="_blank" class="text-[10px] font-bold text-indigo-400 hover:underline flex items-center gap-1">
                        Read Full Story <i data-lucide="external-link" class="w-3 h-3"></i>
                    </a>
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
    currentNewsFilter = category;
    document.querySelectorAll('.news-tab').forEach(tab => {
        tab.classList.remove('active', 'bg-indigo-600', 'text-white');
        tab.classList.add('text-slate-500');
        if (tab.textContent.toLowerCase() === category || (category === 'all' && tab.textContent === 'All')) {
            tab.classList.add('active', 'bg-indigo-600', 'text-white');
            tab.classList.remove('text-slate-500');
        }
    });
    renderNews();
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
    if (!supabaseClient) {
        resources = [];
        folders = [];
        renderResources();
        return;
    }

    try {
        // Fetch Folders
        let folderQuery = supabaseClient.from('folders').select('*');
        if (currentFolderId) {
            folderQuery = folderQuery.eq('parent_id', currentFolderId);
        } else {
            folderQuery = folderQuery.is('parent_id', null);
        }
        const { data: fData, error: fErr } = await folderQuery.order('name', { ascending: true });

        // Fetch Resources
        let resourceQuery = supabaseClient.from('resources').select('*');
        if (currentFolderId) {
            resourceQuery = resourceQuery.eq('folder_id', currentFolderId);
        } else {
            resourceQuery = resourceQuery.is('folder_id', null);
        }
        const { data: rData, error: rErr } = await resourceQuery.order('created_at', { ascending: false });

        if (fErr && fErr.code !== 'PGRST116' && fErr.code !== '42P01') throw fErr; // 42P01 is table not found
        if (rErr) throw rErr;
        
        folders = fData || [];
        resources = rData || [];
        renderResources();
        renderBreadcrumbs();
    } catch (err) {
        console.error("Error fetching data:", err);
        showToast("Failed to fetch data", "alert-circle");
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
        const table = itemType === 'folder' ? 'folders' : 'resources';
        const { error } = await supabaseClient.from(table).delete().eq('id', id);
        if (error) throw error;
        
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
        const { data: allFolders, error } = await supabaseClient.from('folders').select('*').order('name', { ascending: true });
        if (error) throw error;

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
        
        const { error } = await supabaseClient.from(table).update({ [column]: selectedFolderIdForMove }).eq('id', contextMenuItem.id);
        if (error) throw error;
        
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
        const { error } = await supabaseClient.from('folders').insert([{
            name, description, parent_id: currentFolderId
        }]);
        if (error) throw error;
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
        // Fetch ALL resources and folders for context
        const { data: allRes } = await supabaseClient.from('resources').select('*');
        const { data: allFolders } = await supabaseClient.from('folders').select('*');
        
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
            model: "gemini-3-flash-preview",
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
        const prompt = "Generate a short, inspiring study tip or motivational quote for a student. Max 100 characters.";
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        insightText.textContent = `"${response.text.trim()}"`;
    } catch (err) {
        console.error("Insight Error:", err);
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
