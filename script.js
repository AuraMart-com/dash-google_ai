// Initialize Lucide Icons
lucide.createIcons();

// Supabase Configuration
const SUPABASE_URL = 'https://arqkzpnqfceqzrymzrnf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFycWt6cG5xZmNlcXpyeW16cm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTI1MzgsImV4cCI6MjA4ODI2ODUzOH0.XIBiWsg1oUcvlxmPXacA5pRWmDL6CgWku3r6CbDuk8Y';
let supabaseClient = null;

try {
    // Initialize Supabase using the global 'supabase' object from the CDN
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase initialized successfully");
} catch (e) {
    console.error("Supabase initialization failed", e);
}

// Mock Data (Fallback)
const MOCK_RESOURCES = [
    {
        id: 1,
        title: "Atomic Habits",
        type: "Book",
        author: "James Clear",
        image: "https://picsum.photos/seed/habits/400/300",
        tags: ["Productivity", "Self-help"],
        is_offline: false,
        link_url: "https://jamesclear.com/atomic-habits"
    },
    {
        id: 2,
        title: "Advanced React Patterns",
        type: "Video",
        author: "Frontend Masters",
        image: "https://picsum.photos/seed/react/400/300",
        tags: ["Development", "React"],
        is_offline: false,
        link_url: "https://frontendmasters.com"
    }
];

// State
let resources = [];

// DOM Elements
const newsFeed = document.getElementById('news-feed');
const resourceGallery = document.getElementById('resource-gallery');
const chatWidget = document.getElementById('chat-widget');
const openChatBtn = document.getElementById('open-chat');
const closeChatBtn = document.getElementById('close-chat');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat');
const chatMessages = document.getElementById('chat-messages');
const quickAddBtn = document.querySelector('button.bg-indigo-600'); 
const addModal = document.getElementById('add-modal');
const closeModalBtn = document.getElementById('close-modal');
const addResourceForm = document.getElementById('add-resource-form');

// New Modal Elements
const resTypeSelect = document.getElementById('res-type');
const customTypeContainer = document.getElementById('custom-type-container');
const toggleUrlBtn = document.getElementById('toggle-url');
const toggleFileBtn = document.getElementById('toggle-file');
const urlInputContainer = document.getElementById('url-input-container');
const fileInputContainer = document.getElementById('file-input-container');
const resFileInput = document.getElementById('res-file');
const fileNameDisplay = document.getElementById('file-name-display');

let activeInputMode = 'url'; // 'url' or 'file'

// Functions
async function fetchResources() {
    if (!supabaseClient) {
        resources = MOCK_RESOURCES;
        renderResources();
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('resources')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        resources = data && data.length > 0 ? data : MOCK_RESOURCES;
        renderResources();
    } catch (err) {
        console.error("Error fetching resources:", err);
        resources = MOCK_RESOURCES;
        renderResources();
    }
}

function openModal() {
    addModal.classList.add('active');
}

function closeModal() {
    addModal.classList.remove('active');
    addResourceForm.reset();
    customTypeContainer.classList.add('hidden');
    setInputMode('url');
    fileNameDisplay.classList.add('hidden');
}

function setInputMode(mode) {
    activeInputMode = mode;
    if (mode === 'url') {
        toggleUrlBtn.classList.add('bg-white', 'shadow-sm', 'text-indigo-600');
        toggleUrlBtn.classList.remove('text-slate-500');
        toggleFileBtn.classList.remove('bg-white', 'shadow-sm', 'text-indigo-600');
        toggleFileBtn.classList.add('text-slate-500');
        urlInputContainer.classList.remove('hidden');
        fileInputContainer.classList.add('hidden');
    } else {
        toggleFileBtn.classList.add('bg-white', 'shadow-sm', 'text-indigo-600');
        toggleFileBtn.classList.remove('text-slate-500');
        toggleUrlBtn.classList.remove('bg-white', 'shadow-sm', 'text-indigo-600');
        toggleUrlBtn.classList.add('text-slate-500');
        fileInputContainer.classList.remove('hidden');
        urlInputContainer.classList.add('hidden');
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('res-title').value;
    let type = document.getElementById('res-type').value;
    if (type === 'Other') {
        type = document.getElementById('res-custom-type').value || 'Other';
    }
    
    const author = document.getElementById('res-author').value;
    const tagsInput = document.getElementById('res-tags').value;
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()) : [];
    
    const isOffline = document.getElementById('res-offline').checked;
    const url = document.getElementById('res-url').value;
    const file = resFileInput.files[0];
    
    const newResource = {
        title,
        type,
        author,
        image: `https://picsum.photos/seed/${Math.random()}/400/300`,
        tags,
        link_url: activeInputMode === 'url' ? url : null,
        is_offline: activeInputMode === 'url' ? isOffline : true,
        file_name: activeInputMode === 'file' ? file?.name : null
    };

    const submitBtn = addResourceForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
    lucide.createIcons();

    if (supabaseClient) {
        try {
            const { error } = await supabaseClient
                .from('resources')
                .insert([newResource]);
            
            if (error) throw error;
            await fetchResources();
            closeModal();
        } catch (err) {
            alert("Error saving to Supabase. Check console.");
            console.error(err);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            lucide.createIcons();
        }
    } else {
        resources.unshift({ id: Date.now(), ...newResource });
        renderResources();
        closeModal();
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        lucide.createIcons();
    }
}

function renderNews() {
    const NEWS_DATA = [
        { title: "New Breakthrough in Quantum Computing", source: "Science Daily", time: "2h ago", category: "Tech" },
        { title: "Top 10 Study Techniques for 2024", source: "EduWeekly", time: "5h ago", category: "Education" },
        { title: "The Future of Remote Learning", source: "Global News", time: "8h ago", category: "Society" }
    ];

    newsFeed.innerHTML = NEWS_DATA.map((news, index) => `
        <div class="news-item p-4 bg-white rounded-xl border border-slate-100 shadow-sm transition-all cursor-pointer animate-fade-in" style="animation-delay: ${index * 0.1}s">
            <div class="flex justify-between items-start mb-2">
                <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">${news.category}</span>
                <span class="text-[10px] text-slate-400">${news.time}</span>
            </div>
            <h3 class="text-sm font-semibold text-slate-800 leading-snug mb-1">${news.title}</h3>
            <p class="text-[11px] text-slate-500">${news.source}</p>
        </div>
    `).join('');
}

function renderResources() {
    if (resources.length === 0) {
        resourceGallery.innerHTML = '<p class="col-span-2 text-center text-slate-400 py-10">No resources found. Click Quick Add to start!</p>';
        return;
    }

    resourceGallery.innerHTML = resources.map((res, index) => `
        <div class="resource-card group relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all animate-fade-in" style="animation-delay: ${index * 0.1}s">
            <div class="aspect-video overflow-hidden relative">
                <img src="${res.image}" alt="${res.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer">
                <div class="resource-overlay absolute inset-0 bg-indigo-900/40 flex items-center justify-center gap-3">
                    <button class="w-10 h-10 bg-white rounded-full flex items-center justify-center text-indigo-600 hover:scale-110 transition-transform">
                        <i data-lucide="${res.type === 'Video' ? 'play' : 'eye'}" class="w-5 h-5"></i>
                    </button>
                    <button class="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-600 hover:scale-110 transition-transform">
                        <i data-lucide="bookmark" class="w-5 h-5"></i>
                    </button>
                </div>
                <div class="absolute top-3 left-3 px-2 py-1 bg-white/90 backdrop-blur rounded-lg text-[10px] font-bold text-slate-800 shadow-sm flex items-center gap-1">
                    <i data-lucide="${res.is_offline ? 'hard-drive' : 'globe'}" class="w-3 h-3"></i>
                    ${res.type}
                </div>
            </div>
            <div class="p-4">
                <div class="flex items-start justify-between mb-1">
                    <h3 class="font-bold text-slate-800 leading-tight">${res.title}</h3>
                    ${res.link_url || res.file_name ? `
                        <a href="${res.link_url || '#'}" target="_blank" class="text-indigo-600 hover:text-indigo-800">
                            <i data-lucide="external-link" class="w-4 h-4"></i>
                        </a>
                    ` : ''}
                </div>
                <p class="text-xs text-slate-500 mb-3">${res.author || 'Unknown'}</p>
                <div class="flex flex-wrap gap-1">
                    ${(res.tags || []).map(tag => `<span class="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">${tag}</span>`).join('')}
                </div>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

function addMessage(text, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex gap-2 ${isUser ? 'flex-row-reverse' : ''} animate-fade-in`;
    
    msgDiv.innerHTML = `
        <div class="w-8 h-8 rounded-lg ${isUser ? 'bg-slate-200' : 'bg-indigo-100'} flex items-center justify-center shrink-0">
            <i data-lucide="${isUser ? 'user' : 'bot'}" class="w-4 h-4 ${isUser ? 'text-slate-600' : 'text-indigo-600'}"></i>
        </div>
        <div class="${isUser ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'} p-3 rounded-2xl text-sm shadow-sm max-w-[80%]">
            ${text}
        </div>
    `;
    
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    lucide.createIcons();
}

function handleChat() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    addMessage(text, true);
    chatInput.value = '';
    
    // Mock response
    setTimeout(() => {
        const responses = [
            "That's a great question! Based on your current books, I recommend checking out Chapter 3 of Atomic Habits.",
            "I've added that to your research notes. Would you like me to find related videos?",
            "Focus is key. Have you tried the Pomodoro technique for this task?",
            "I'm analyzing your study patterns. You seem to be most productive in the mornings!"
        ];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        addMessage(randomResponse);
    }, 1000);
}

// Event Listeners
resTypeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'Other') {
        customTypeContainer.classList.remove('hidden');
    } else {
        customTypeContainer.classList.add('hidden');
    }
});

toggleUrlBtn.addEventListener('click', () => setInputMode('url'));
toggleFileBtn.addEventListener('click', () => setInputMode('file'));

resFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        fileNameDisplay.textContent = `Selected: ${e.target.files[0].name}`;
        fileNameDisplay.classList.remove('hidden');
    }
});

quickAddBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);
addResourceForm.addEventListener('submit', handleFormSubmit);

// Close modal on outside click
addModal.addEventListener('click', (e) => {
    if (e.target === addModal) closeModal();
});

closeChatBtn.addEventListener('click', () => {
    chatWidget.classList.add('translate-y-full', 'opacity-0', 'pointer-events-none');
    openChatBtn.classList.remove('scale-0', 'opacity-0');
    openChatBtn.classList.add('scale-100', 'opacity-100');
});

openChatBtn.addEventListener('click', () => {
    chatWidget.classList.remove('translate-y-full', 'opacity-0', 'pointer-events-none');
    openChatBtn.classList.add('scale-0', 'opacity-0');
    openChatBtn.classList.remove('scale-100', 'opacity-100');
});

sendChatBtn.addEventListener('click', handleChat);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleChat();
});

// Navigation logic (Mock)
document.querySelectorAll('[data-nav]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('[data-nav]').forEach(l => {
            l.classList.remove('text-indigo-600', 'bg-indigo-50', 'font-medium');
            l.classList.add('text-slate-600', 'hover:bg-slate-50');
        });
        link.classList.add('text-indigo-600', 'bg-indigo-50', 'font-medium');
        link.classList.remove('text-slate-600', 'hover:bg-slate-50');
        
        // In a real app, you'd switch views here
        console.log(`Navigating to: ${link.dataset.nav}`);
    });
});

// Initialize
renderNews();
fetchResources();
