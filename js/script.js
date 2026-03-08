// Initialize Lucide Icons
console.log("StudyHub script loading...");
lucide.createIcons();

// Gemini API Integration
import { GoogleGenAI } from "@google/genai";

// API Key Management
let apiKeys = [];
try {
    const savedKeys = localStorage.getItem('studyhub_api_keys');
    if (savedKeys) apiKeys = JSON.parse(savedKeys);
    
    // Add default key if none exists
    if (apiKeys.length === 0) {
        apiKeys.push({
            id: 'default',
            key: 'AIzaSyASIew7fF7UigK7BqgGHOFLim9j67URVkM',
            name: 'Default Key',
            active: true
        });
        localStorage.setItem('studyhub_api_keys', JSON.stringify(apiKeys));
    }
} catch (e) {
    console.warn("Failed to load API keys:", e);
}

function getActiveApiKey() {
    const active = apiKeys.find(k => k.active);
    return active ? active.key : null;
}

let ai = null;
function initGemini() {
    const key = getActiveApiKey();
    if (key) {
        ai = new GoogleGenAI({ apiKey: key });
    }
}
initGemini();

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
let currentFolderId = null;
let activeInputMode = 'url'; // 'url' or 'file'
let contextMenuItem = null; // Stores the item currently targeted by context menu
let currentSort = 'newest';
let searchQuery = '';
let chatMode = 'local'; // 'local' or 'web'
let isChatMaximized = false;

// Settings State
let settings = {
    compactSidebar: false,
    darkMode: true
};

try {
    const savedSettings = localStorage.getItem('studyhub_settings');
    if (savedSettings) settings = { ...settings, ...JSON.parse(savedSettings) };
} catch (e) {
    console.warn("Failed to load settings:", e);
}

// DOM Elements
const insightText = document.getElementById('insight-text');
const refreshInsightBtn = document.getElementById('refresh-insight');
const resourceGallery = document.getElementById('resource-gallery');
const chatWidget = document.getElementById('chat-widget');
const openChatBtn = document.getElementById('open-chat');
const closeChatBtn = document.getElementById('close-chat');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat');
const chatMessages = document.getElementById('chat-messages');
const globalSearchInput = document.getElementById('global-search');
const maximizeChatBtn = document.getElementById('maximize-chat');
const chatModeToggle = document.getElementById('chat-mode-toggle');
const chatModeMenu = document.getElementById('chat-mode-menu');
const modeIcon = document.getElementById('mode-icon');
const modeText = document.getElementById('mode-text');

const quickAddToggle = document.getElementById('quick-add-toggle');
const quickAddMenu = document.getElementById('quick-add-menu');
const addModal = document.getElementById('add-modal');
const folderModal = document.getElementById('folder-modal');
const moveModal = document.getElementById('move-modal');
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
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarClose = document.getElementById('sidebar-close');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// Settings Elements
const settingsModal = document.getElementById('settings-modal');
const openSettingsBtn = document.getElementById('open-settings');
const apiKeysList = document.getElementById('api-keys-list');
const newApiKeyInput = document.getElementById('new-api-key');
const addApiKeyBtn = document.getElementById('add-api-key');
const saveSettingsBtn = document.getElementById('save-settings');
const clearCacheBtn = document.getElementById('clear-cache');
const exportDataBtn = document.getElementById('export-data');

// Sidebar Toggle
if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('open');
            sidebarOverlay.classList.toggle('active');
        } else {
            sidebar.classList.toggle('minimized');
        }
    });
}

if (sidebarClose) {
    sidebarClose.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    });
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    });
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
window.openModal = function() {
    addModal.classList.add('active');
    quickAddMenu.classList.remove('active');
}

window.closeModal = function() {
    addModal.classList.remove('active');
    addResourceForm.reset();
    document.getElementById('modal-title').textContent = 'Add New Resource';
    document.getElementById('submit-btn-text').textContent = 'Save Resource';
    customTypeContainer.classList.add('hidden');
    setInputMode('url');
    fileNameDisplay.classList.add('hidden');
    contextMenuItem = null;
}

window.openFolderModal = function() {
    folderModal.classList.add('active');
    quickAddMenu.classList.remove('active');
}

window.closeFolderModal = function() {
    folderModal.classList.remove('active');
    addFolderForm.reset();
}

window.openMoveModal = function(item) {
    contextMenuItem = item;
    moveModal.classList.add('active');
    renderFolderListForMove();
}

window.closeMoveModal = function() {
    moveModal.classList.remove('active');
    contextMenuItem = null;
}

window.openOfflineModal = function(path) {
    const modal = document.getElementById('offline-modal');
    const input = document.getElementById('offline-path-input');
    input.value = path;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

window.closeOfflineModal = function() {
    const modal = document.getElementById('offline-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

window.openDriveViewer = function(url, title) {
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
    } else if (url.startsWith('Local:')) {
        // Can't open local paths in iframe
        showToast("Cannot open local paths in viewer", "alert-circle");
        closeDriveViewer();
        return;
    }
    
    driveIframe.src = previewUrl;
    viewerExternal.onclick = () => window.open(url, '_blank');
    
    driveIframe.onload = () => {
        viewerLoader.style.display = 'none';
    };
}

window.closeDriveViewer = function() {
    driveViewerModal.classList.add('hidden');
    driveViewerModal.classList.remove('flex');
    driveIframe.src = '';
}

window.openDeleteModal = function(item) {
    contextMenuItem = item;
    document.getElementById('delete-item-name').textContent = item.name || item.title;
    deleteModal.classList.add('active');
}

window.closeDeleteModal = function() {
    deleteModal.classList.remove('active');
    contextMenuItem = null;
}

// Settings Handlers
window.openSettingsModal = function() {
    settingsModal.classList.add('active');
    renderApiKeys();
    
    // Load current settings into UI
    document.getElementById('setting-timer-duration').value = settings.timerDuration;
    document.getElementById('setting-timer-sound').checked = settings.timerSound;
    document.getElementById('setting-compact-sidebar').checked = settings.compactSidebar;
}

window.closeSettingsModal = function() {
    settingsModal.classList.remove('active');
}

function renderApiKeys() {
    apiKeysList.innerHTML = '';
    apiKeys.forEach(keyObj => {
        const keyEl = document.createElement('div');
        keyEl.className = `p-3 rounded-xl border ${keyObj.active ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-900/50'} flex items-center justify-between gap-3`;
        keyEl.innerHTML = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-200 truncate">${keyObj.name}</span>
                    ${keyObj.active ? '<span class="text-[8px] bg-indigo-600 text-white px-1.5 py-0.5 rounded uppercase font-black">Active</span>' : ''}
                </div>
                <p class="text-[10px] text-slate-500 font-mono truncate">${keyObj.key.substring(0, 8)}••••••••••••</p>
            </div>
            <div class="flex items-center gap-1">
                ${!keyObj.active ? `
                    <button onclick="activateApiKey('${keyObj.id}')" class="p-1.5 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors" title="Activate">
                        <i data-lucide="check" class="w-4 h-4"></i>
                    </button>
                ` : ''}
                <button onclick="deleteApiKey('${keyObj.id}')" class="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" title="Delete">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        apiKeysList.appendChild(keyEl);
    });
    lucide.createIcons();
}

window.activateApiKey = (id) => {
    apiKeys = apiKeys.map(k => ({ ...k, active: k.id === id }));
    localStorage.setItem('studyhub_api_keys', JSON.stringify(apiKeys));
    initGemini();
    renderApiKeys();
    showToast("API Key activated", "check");
};

window.deleteApiKey = (id) => {
    if (apiKeys.length <= 1) {
        showToast("Cannot delete the last API key", "alert-circle");
        return;
    }
    const wasActive = apiKeys.find(k => k.id === id)?.active;
    apiKeys = apiKeys.filter(k => k.id !== id);
    if (wasActive && apiKeys.length > 0) {
        apiKeys[0].active = true;
    }
    localStorage.setItem('studyhub_api_keys', JSON.stringify(apiKeys));
    initGemini();
    renderApiKeys();
    showToast("API Key deleted", "trash-2");
};

function addApiKey() {
    const key = newApiKeyInput.value.trim();
    if (!key) return;
    
    const newKey = {
        id: `key-${Date.now()}`,
        key: key,
        name: `Key ${apiKeys.length + 1}`,
        active: false
    };
    
    apiKeys.push(newKey);
    localStorage.setItem('studyhub_api_keys', JSON.stringify(apiKeys));
    newApiKeyInput.value = '';
    renderApiKeys();
    showToast("API Key added", "plus");
}

function saveAllSettings() {
    settings.compactSidebar = document.getElementById('setting-compact-sidebar').checked;
    
    localStorage.setItem('studyhub_settings', JSON.stringify(settings));
    
    // Apply settings
    if (settings.compactSidebar) {
        sidebar.classList.add('minimized');
    } else {
        sidebar.classList.remove('minimized');
    }
    
    showToast("Settings saved successfully", "save");
    closeSettingsModal();
}

window.copyOfflinePath = function() {
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

    // Combine and Sort
    let allItems = [
        ...folders.map(f => ({ ...f, itemType: 'folder' })),
        ...resources.map(r => ({ ...r, itemType: 'resource' }))
    ];

    // Apply Search Filter
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        allItems = allItems.filter(item => {
            const name = (item.name || item.title).toLowerCase();
            const author = (item.author || '').toLowerCase();
            const tags = (item.tags || []).join(' ').toLowerCase();
            return name.includes(q) || author.includes(q) || tags.includes(q);
        });
    }

    // Apply Sorting
    allItems.sort((a, b) => {
        // Pinning first
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;

        if (currentSort === 'folders') {
            if (a.itemType === 'folder' && b.itemType !== 'folder') return -1;
            if (a.itemType !== 'folder' && b.itemType === 'folder') return 1;
        }

        if (currentSort === 'az') {
            const nameA = (a.name || a.title).toLowerCase();
            const nameB = (b.name || b.title).toLowerCase();
            return nameA.localeCompare(nameB);
        }

        // Default: Newest First
        return new Date(b.created_at) - new Date(a.created_at);
    });

    allItems.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = `resource-card group relative bg-[#1e293b] rounded-2xl border ${item.is_pinned ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-800'} p-4 hover:border-indigo-500 transition-all cursor-pointer animate-fade-in`;
        itemEl.style.animationDelay = `${index * 0.05}s`;

        if (item.itemType === 'folder') {
            itemEl.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-400">
                        <i data-lucide="folder" class="w-6 h-6 fill-current"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            <h3 class="font-bold text-slate-200 truncate">${item.name}</h3>
                            ${item.is_pinned ? '<i data-lucide="pin" class="w-3 h-3 text-indigo-400 rotate-45"></i>' : ''}
                        </div>
                        <p class="text-[10px] text-slate-500 truncate">${item.description || 'Folder'}</p>
                    </div>
                    <button class="more-btn p-2 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800 transition-colors relative z-10">
                        <i data-lucide="more-vertical" class="w-4 h-4"></i>
                    </button>
                </div>
            `;
            itemEl.addEventListener('click', (e) => {
                if (e.target.closest('.more-btn')) {
                    e.stopPropagation();
                    showContextMenu(e, item, 'folder');
                } else {
                    navigateToFolder(item.id);
                }
            });
        } else {
            const icon = getResourceIcon(item.type);
            const displayUrl = item.link_url || '#';
            const isLocalReference = item.link_url && item.link_url.startsWith('Local:');
            const isGoogleDrive = item.is_google_drive;
            const isUploadedFile = item.link_url && (item.link_url.includes('supabase.co/storage') || item.link_url.startsWith('blob:'));
            
            const linkLabel = isLocalReference ? 'Local File' : (isGoogleDrive ? 'View in App' : (isUploadedFile ? 'View File' : 'Open Link'));
            const linkIcon = isLocalReference ? 'hard-drive' : (isGoogleDrive ? 'file-text' : (isUploadedFile ? 'file' : 'external-link'));

            itemEl.innerHTML = `
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-400 transition-colors">
                        <i data-lucide="${icon}" class="w-6 h-6"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-2">
                            <div class="flex items-center gap-2 min-w-0">
                                <h3 class="font-bold text-slate-200 truncate">${item.title}</h3>
                                ${item.is_pinned ? '<i data-lucide="pin" class="w-3 h-3 text-indigo-400 rotate-45"></i>' : ''}
                            </div>
                            <button class="more-btn p-1 text-slate-500 hover:text-white rounded transition-colors relative z-10">
                                <i data-lucide="more-vertical" class="w-4 h-4"></i>
                            </button>
                        </div>
                        <p class="text-xs text-slate-500 truncate mb-2">${item.author || 'Unknown'}</p>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-bold text-indigo-400 flex items-center gap-1">
                                <i data-lucide="${linkIcon}" class="w-3 h-3"></i>
                                ${linkLabel}
                            </span>
                            <span class="text-[10px] text-slate-600">•</span>
                            <span class="text-[10px] text-slate-500">${item.type}</span>
                        </div>
                    </div>
                </div>
            `;
            itemEl.addEventListener('click', (e) => {
                if (e.target.closest('.more-btn')) {
                    e.stopPropagation();
                    showContextMenu(e, item, 'resource');
                } else {
                    if (isLocalReference) {
                        openOfflineModal(item.link_url);
                    } else if (isGoogleDrive || isUploadedFile) {
                        openDriveViewer(item.link_url, item.title);
                    } else {
                        window.open(displayUrl, '_blank');
                    }
                }
            });
        }
        resourceGallery.appendChild(itemEl);
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

window.navigateToFolder = function(id) {
    currentFolderId = id;
    fetchResources();
}

// Context Menu Logic
function showContextMenu(e, item, type) {
    contextMenuItem = { ...item, itemType: type };
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.top = `${e.clientY}px`;
    
    // Update Pin text
    const pinBtn = document.getElementById('ctx-pin');
    pinBtn.innerHTML = `
        <i data-lucide="${item.is_pinned ? 'pin-off' : 'pin'}" class="w-4 h-4"></i>
        ${item.is_pinned ? 'Unpin from Top' : 'Pin to Top'}
    `;
    lucide.createIcons();
    
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

async function togglePin() {
    if (!contextMenuItem) return;
    const { id, itemType, is_pinned } = contextMenuItem;
    const newPinnedStatus = !is_pinned;

    try {
        if (supabaseClient) {
            const table = itemType === 'folder' ? 'folders' : 'resources';
            const { error } = await supabaseClient.from(table).update({ is_pinned: newPinnedStatus }).eq('id', id);
            if (error) {
                console.error("Supabase Pin Error:", error);
                throw error;
            }
        }
        
        // Update local state
        if (itemType === 'folder') {
            folders = folders.map(f => f.id === id ? { ...f, is_pinned: newPinnedStatus } : f);
            localStorage.setItem('studyhub_folders', JSON.stringify(folders));
        } else {
            resources = resources.map(r => r.id === id ? { ...r, is_pinned: newPinnedStatus } : r);
            localStorage.setItem('studyhub_resources', JSON.stringify(resources));
        }
        
        showToast(newPinnedStatus ? "Pinned to Cloud" : "Unpinned from Cloud", "pin");
        renderResources();
    } catch (err) {
        console.error("Pin operation failed:", err);
        // Fallback to local if cloud fails
        if (itemType === 'folder') {
            folders = folders.map(f => f.id === id ? { ...f, is_pinned: newPinnedStatus } : f);
            localStorage.setItem('studyhub_folders', JSON.stringify(folders));
        } else {
            resources = resources.map(r => r.id === id ? { ...r, is_pinned: newPinnedStatus } : r);
            localStorage.setItem('studyhub_resources', JSON.stringify(resources));
        }
        showToast(newPinnedStatus ? "Pinned (Local Only)" : "Unpinned (Local Only)", "alert-circle");
        renderResources();
    } finally {
        hideContextMenu();
    }
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
            
            if (error) {
                console.warn("Supabase upload failed, using temporary blob URL:", error);
                // Fallback: Use a temporary blob URL so it can be viewed in the current session
                finalUrl = URL.createObjectURL(file);
                showToast("Stored temporarily. Create a 'resources' bucket in Supabase for permanent storage.", "alert-triangle");
            } else {
                const { data: { publicUrl } } = supabaseClient.storage.from('resources').getPublicUrl(`uploads/${fileName}`);
                finalUrl = publicUrl;
            }
        } catch (err) {
            console.error("Upload error:", err);
            finalUrl = `Local: ${file.name}`;
            showToast("Stored as local reference", "info");
        }
    } else if (activeInputMode === 'file' && file && !supabaseClient) {
        finalUrl = `Local: ${file.name}`;
        showToast("Stored as local reference (No Supabase)", "info");
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
window.setChatMode = function(mode) {
    chatMode = mode;
    if (mode === 'local') {
        modeIcon.setAttribute('data-lucide', 'library');
        modeText.textContent = 'Local Library';
        chatInput.placeholder = 'Search your library...';
    } else {
        modeIcon.setAttribute('data-lucide', 'globe');
        modeText.textContent = 'Web Search';
        chatInput.placeholder = 'Search the web...';
    }
    chatModeMenu.classList.add('hidden');
    lucide.createIcons();
}

function toggleMaximizeChat() {
    isChatMaximized = !isChatMaximized;
    chatWidget.classList.toggle('chat-maximized', isChatMaximized);
    maximizeChatBtn.innerHTML = `<i data-lucide="${isChatMaximized ? 'minimize-2' : 'maximize-2'}" class="w-4 h-4"></i>`;
    lucide.createIcons();
}

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
        <div class="bg-[#1e293b] text-slate-300 rounded-2xl rounded-tl-none border border-slate-800 p-3 text-sm shadow-sm max-w-[80%] bot-content leading-relaxed">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    chatMessages.appendChild(botMsgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    lucide.createIcons();

    const botContent = botMsgDiv.querySelector('.bot-content');

    try {
        const activeKey = getActiveApiKey();
        if (!activeKey) {
            throw new Error("Gemini API Key is missing. Please add one in Settings.");
        }
        
        if (!ai) initGemini();
        if (!ai) throw new Error("Failed to initialize Gemini AI.");
        
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
            You are a professional Study Assistant for StudyHub. 
            You have access to the user's study resources and folders.
            
            Current Resources:
            ${(allRes || []).map(r => `- ${r.title} (${r.type}) by ${r.author || 'Unknown'}. Tags: ${(r.tags || []).join(', ')}`).join('\n')}
            
            Current Folders:
            ${(allFolders || []).map(f => `- ${f.name}: ${f.description || 'No description'}`).join('\n')}
            
            Search Mode: ${chatMode === 'web' ? 'Internet Search Enabled' : 'Local Library Only'}

            Answer the user's questions based on the selected mode. 
            If in Local Library mode, strictly use the provided resources. 
            If in Web Search mode, you can use Google Search to find external information.
            
            Be concise, professional, and helpful. Use markdown for formatting.
        `;

        const tools = chatMode === 'web' ? [{ googleSearch: {} }] : [];

        const response = await ai.models.generateContentStream({
            model: "gemini-3.1-flash-lite-preview",
            contents: [{ role: 'user', parts: [{ text }] }],
            config: {
                systemInstruction: context,
                tools: tools
            }
        });

        botContent.innerHTML = '';
        let fullText = '';
        
        for await (const chunk of response) {
            const chunkText = chunk.text;
            fullText += chunkText;
            // Simple markdown-ish bolding for better readability
            botContent.innerHTML = fullText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            // Extract and show grounding URLs if any
            const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks) {
                const links = groundingChunks
                    .filter(c => c.web)
                    .map(c => `<a href="${c.web.uri}" target="_blank" class="text-indigo-400 hover:underline block text-[10px] truncate">${c.web.title || c.web.uri}</a>`)
                    .join('');
                if (links && !botContent.querySelector('.grounding-links')) {
                    botContent.innerHTML += `<div class="mt-2 pt-2 border-t border-slate-800 grounding-links">${links}</div>`;
                }
            }
            
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    } catch (err) {
        console.error("Gemini Error:", err);
        botContent.innerHTML = "Sorry, I encountered an error while processing your request. Please check your connection and try again.";
    }
}

// Insight Logic
async function fetchDailyInsight() {
    insightText.classList.add('opacity-50');
    try {
        const activeKey = getActiveApiKey();
        if (!activeKey) {
            throw new Error("API Key missing");
        }
        
        if (!ai) initGemini();
        if (!ai) throw new Error("Failed to initialize Gemini AI.");

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

// Initialize
fetchDailyInsight();

const resourceSort = document.getElementById('resource-sort');
if (resourceSort) {
    resourceSort.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderResources();
    });
}

document.getElementById('ctx-pin').addEventListener('click', togglePin);

if (globalSearchInput) {
    globalSearchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderResources();
    });
}

if (maximizeChatBtn) {
    maximizeChatBtn.addEventListener('click', toggleMaximizeChat);
}

if (chatModeToggle) {
    chatModeToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        chatModeMenu.classList.toggle('hidden');
    });
}

if (quickAddToggle) {
    quickAddToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        quickAddMenu.classList.toggle('active');
    });
}

document.addEventListener('click', () => {
    quickAddMenu.classList.remove('active');
    chatModeMenu.classList.add('hidden');
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
window.closeDeleteModal = closeDeleteModal;
window.closeDriveViewer = closeDriveViewer;
window.closeOfflineModal = closeOfflineModal;
window.copyOfflinePath = copyOfflinePath;
window.selectFolderForMove = selectFolderForMove;
window.closeSettingsModal = closeSettingsModal;
window.openSettingsModal = openSettingsModal;
window.setChatMode = setChatMode;

// Settings Event Listeners
if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', openSettingsModal);
}

if (addApiKeyBtn) {
    addApiKeyBtn.addEventListener('click', addApiKey);
}

if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveAllSettings);
}

if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to clear all local data? This will remove your resources, folders, and settings.")) {
            localStorage.clear();
            window.location.reload();
        }
    });
}

if (exportDataBtn) {
    exportDataBtn.addEventListener('click', () => {
        const data = {
            resources,
            folders,
            settings,
            apiKeys
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `studyhub-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        showToast("Data exported successfully", "download");
    });
}
