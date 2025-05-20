// --- Constants and Configuration ---
const YOUTUBE_API_KEY = 'YOUR_YOUTUBE_API_KEY_HERE'; // IMPORTANT: Replace with your actual API key

// --- DOM Elements ---
// Search elements
const searchButton = document.getElementById('search-button');
const searchBar = document.getElementById('search-bar');
const resultsContainer = document.getElementById('results-container');

// Navigation elements
const navLinks = document.querySelectorAll('.nav-link');
const pageContents = document.querySelectorAll('.page-content');

// Player UI elements
const playerContainer = document.getElementById('player-container');
const trackTitleElement = document.getElementById('track-title');
const trackArtistElement = document.getElementById('track-artist');
const playPauseButton = document.getElementById('play-pause-button');
const volumeSlider = document.getElementById('volume-slider');
const nextButton = document.getElementById('next-button');
const prevButton = document.getElementById('prev-button');

// --- Player Control DOM Elements ---
const progressBar = document.getElementById('progress-bar');
const currentTimeElement = document.getElementById('current-time');
const durationElement = document.getElementById('duration');

// --- Playlist DOM Elements ---
const createPlaylistButton = document.getElementById('create-playlist-button');
const playlistCreationModal = document.getElementById('playlist-creation-modal');
const newPlaylistNameInput = document.getElementById('new-playlist-name');
const savePlaylistButton = document.getElementById('save-playlist-button');
const cancelPlaylistButton = document.getElementById('cancel-playlist-button');
const playlistListElement = document.getElementById('playlist-list'); // Ul element in Library
const librarySection = document.getElementById('library-section');


// --- Global Variables ---
let player; // Will hold the YT.Player instance
let currentVideoInfo = { title: '', artist: '' }; // To store current video details (RAW strings)

// --- Playlist Global Variables ---
let playlists = []; // Tracks within playlists will store RAW strings for title/artist
let currentPlayingPlaylist = null; 
let currentlyViewedPlaylistId = null; 

// --- Player Control Global Variables ---
let progressUpdateInterval = null;

// --- Utility for escaping HTML ---
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// --- Helper Function for Time Formatting ---
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// --- Navigation ---
function showPage(pageId) {
    pageContents.forEach(page => {
        if (page.id === pageId + '-section') {
            page.style.display = 'block';
        } else {
            page.style.display = 'none';
        }
    });
    const activeSection = document.getElementById(pageId + '-section');
    if (activeSection) activeSection.style.display = 'block';
    else document.getElementById('search-section').style.display = 'block'; 

    navLinks.forEach(navLink => navLink.classList.remove('active'));
    const activeNavLink = document.querySelector(`.nav-link[data-page="${pageId}"]`);
    if (activeNavLink) activeNavLink.classList.add('active');

    if (pageId === 'library') {
        displayUserPlaylists();
    }
}

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const pageId = link.getAttribute('data-page');
        showPage(pageId);
    });
});

// --- YouTube IFrame Player API ---
function onYouTubeIframeAPIReady() {
    console.log("YouTube IFrame API Ready");
    player = new YT.Player('player-container', {
        height: '0', 
        width: '0',  
        playerVars: {
            'autoplay': 0, 
            'controls': 0, 
            'enablejsapi': 1,
            'modestbranding': 1, 
            'rel': 0 
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}

function onPlayerReady(event) {
    console.log("Player Ready");
    if (player && volumeSlider) {
         player.setVolume(volumeSlider.value);
    }
    currentTimeElement.textContent = formatTime(0);
    durationElement.textContent = formatTime(0);
    progressBar.value = 0;
    progressBar.max = 100; 
}

function onPlayerStateChange(event) {
    console.log("Player State Changed:", event.data, "Current Video Title:", currentVideoInfo.title);
    
    if (progressUpdateInterval) {
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;
    }

    if (event.data == YT.PlayerState.PLAYING) {
        playPauseButton.textContent = '❚❚';
        updateTrackInfoDisplay(currentVideoInfo.title, currentVideoInfo.artist); // Uses raw strings with textContent
        
        const duration = player.getDuration();
        durationElement.textContent = formatTime(duration);
        progressBar.max = duration; 

        progressUpdateInterval = setInterval(() => {
            const currentTime = player.getCurrentTime();
            currentTimeElement.textContent = formatTime(currentTime);
            progressBar.value = currentTime;
        }, 1000);

    } else if (event.data == YT.PlayerState.PAUSED) {
        playPauseButton.textContent = '▶';
    } else if (event.data == YT.PlayerState.ENDED) {
        playPauseButton.textContent = '▶';
        const endedDuration = player.getDuration(); 
        currentTimeElement.textContent = formatTime(endedDuration); 
        progressBar.value = endedDuration; 

        if (currentPlayingPlaylist) {
            const playlist = playlists.find(p => p.id === currentPlayingPlaylist.playlistId);
            if (playlist && playlist.tracks.length > 0) {
                currentPlayingPlaylist.trackIndex++;
                if (currentPlayingPlaylist.trackIndex >= playlist.tracks.length) {
                    currentPlayingPlaylist.trackIndex = 0; 
                }
                const nextTrack = playlist.tracks[currentPlayingPlaylist.trackIndex];
                playVideo(nextTrack.videoId, nextTrack.title, nextTrack.artist); // title/artist are raw
            }
        } else {
            currentTimeElement.textContent = formatTime(0);
            progressBar.value = 0;
        }
    } else if (event.data == YT.PlayerState.CUED) {
        playPauseButton.textContent = '▶';
        const cuedDuration = player.getDuration();
        if (cuedDuration > 0) {
            durationElement.textContent = formatTime(cuedDuration);
            progressBar.max = cuedDuration;
        }
        if (currentVideoInfo.title) { // currentVideoInfo holds raw strings
            updateTrackInfoDisplay(currentVideoInfo.title, currentVideoInfo.artist);
        }
    } else if (event.data == YT.PlayerState.BUFFERING) {
        console.log("Player is buffering...");
    } else if (event.data == YT.PlayerState.UNSTARTED) {
        playPauseButton.textContent = '▶';
        currentTimeElement.textContent = formatTime(0);
        durationElement.textContent = formatTime(0);
        progressBar.value = 0;
    }
}


function onPlayerError(event) {
    console.error('YouTube Player Error:', event.data);
    trackTitleElement.textContent = 'Player Error'; // Safe with textContent
    trackArtistElement.textContent = 'Could not load video.'; // Safe with textContent
    if (progressUpdateInterval) {
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;
    }
    currentTimeElement.textContent = formatTime(0);
    durationElement.textContent = formatTime(0);
    progressBar.value = 0;
}

// playVideo expects RAW title and artist
function playVideo(videoId, title, artist) { 
    if (!player || typeof player.loadVideoById !== 'function') {
        console.error('Player is not initialized yet.');
        trackTitleElement.textContent = 'Player not ready'; // Safe
        return;
    }
    
    // Store raw title and artist
    currentVideoInfo = { title: title, artist: artist }; 
    console.log(`Loading video: ${videoId} - ${currentVideoInfo.title} by ${currentVideoInfo.artist}`);
    
    if (progressUpdateInterval) clearInterval(progressUpdateInterval);
    progressUpdateInterval = null;
    currentTimeElement.textContent = formatTime(0);
    durationElement.textContent = formatTime(0); 
    progressBar.value = 0;
    progressBar.max = 100; 

    player.loadVideoById(videoId); 
    updateTrackInfoDisplay(currentVideoInfo.title, currentVideoInfo.artist); // Pass raw strings
    playPauseButton.textContent = '❚❚'; 
}

// updateTrackInfoDisplay receives RAW title and artist, uses textContent
function updateTrackInfoDisplay(title, artist) {
    trackTitleElement.textContent = title || 'No Title';
    trackArtistElement.textContent = artist || ''; 
}

// --- YouTube API Search ---
async function searchYouTube(query) {
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
        resultsContainer.innerHTML = '<p style="color:red;">Error: YouTube API key is missing. Please add your API key in script.js.</p>';
        console.error('YouTube API key is missing.');
        return;
    }
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=12&key=${YOUTUBE_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`YouTube API Error: ${response.status} ${errorData.error.message ? errorData.error.message : 'Unknown API Error'}`);
        }
        const data = await response.json();
        displayResults(data.items);
    } catch (error) {
        console.error('Error fetching from YouTube API:', error);
        resultsContainer.innerHTML = `<p>Error fetching videos: ${error.message}. Check console for details.</p>`;
    }
}

// --- Playlist Core Functions ---
function savePlaylists() {
    localStorage.setItem('musicHubPlaylists', JSON.stringify(playlists)); // Playlists store raw strings
}

function loadPlaylists() {
    const storedPlaylists = localStorage.getItem('musicHubPlaylists');
    if (storedPlaylists) {
        playlists = JSON.parse(storedPlaylists); // Playlists contain raw strings
    } else {
        playlists = []; 
    }
}

function displayUserPlaylists() {
    if (!playlistListElement) return; 
    playlistListElement.innerHTML = ''; 
    if (playlists.length === 0) {
        playlistListElement.innerHTML = '<li>No playlists yet. Create one!</li>';
        return;
    }

    playlists.forEach(playlist => {
        const listItem = document.createElement('li');
        listItem.classList.add('playlist-item-entry'); 
        // Escape playlist name for display in innerHTML
        listItem.innerHTML = `
            <div class="playlist-info">
                <span class="playlist-name">${escapeHTML(playlist.name)} (${playlist.tracks.length} tracks)</span>
            </div>
            <div class="playlist-item-buttons">
                <button class="play-playlist-btn" data-playlist-id="${playlist.id}">Play All</button>
                <button class="view-playlist-btn" data-playlist-id="${playlist.id}">View Tracks</button>
                <button class="delete-playlist-btn" data-playlist-id="${playlist.id}">Delete</button>
            </div>
            <div class="playlist-tracks-container" id="tracks-for-${playlist.id}" style="display:none;"></div>
        `;
        playlistListElement.appendChild(listItem);
    });

    attachPlaylistActionListeners();
}

function attachPlaylistActionListeners() {
    document.querySelectorAll('.play-playlist-btn').forEach(button => {
        button.removeEventListener('click', handlePlayPlaylist); 
        button.addEventListener('click', handlePlayPlaylist);
    });
    document.querySelectorAll('.view-playlist-btn').forEach(button => {
        button.removeEventListener('click', handleViewPlaylistTracks);
        button.addEventListener('click', handleViewPlaylistTracks);
    });
    document.querySelectorAll('.delete-playlist-btn').forEach(button => {
        button.removeEventListener('click', handleDeletePlaylist);
        button.addEventListener('click', handleDeletePlaylist);
    });
}

function handlePlayPlaylist(event) {
    const playlistId = event.target.getAttribute('data-playlist-id');
    const playlist = playlists.find(p => p.id === playlistId);
    if (playlist && playlist.tracks.length > 0) {
        currentPlayingPlaylist = { playlistId: playlist.id, trackIndex: 0 };
        const firstTrack = playlist.tracks[0]; // track title/artist are raw
        playVideo(firstTrack.videoId, firstTrack.title, firstTrack.artist);
    } else {
        alert("Playlist is empty or not found.");
    }
}

function handleViewPlaylistTracks(event) {
    const playlistId = event.target.getAttribute('data-playlist-id');
    const tracksContainer = document.getElementById(`tracks-for-${playlistId}`);
    if (!tracksContainer) return;

    if (currentlyViewedPlaylistId && currentlyViewedPlaylistId !== playlistId) {
        const prevTracksContainer = document.getElementById(`tracks-for-${currentlyViewedPlaylistId}`);
        if (prevTracksContainer) {
             prevTracksContainer.style.display = 'none';
             const prevViewBtn = document.querySelector(`.view-playlist-btn[data-playlist-id="${currentlyViewedPlaylistId}"]`);
             if(prevViewBtn) prevViewBtn.textContent = "View Tracks";
        }
    }

    if (tracksContainer.style.display === 'none') {
        displayTracksForPlaylist(playlistId, tracksContainer); // Will handle escaping for display
        tracksContainer.style.display = 'block';
        currentlyViewedPlaylistId = playlistId;
        event.target.textContent = "Hide Tracks";
    } else {
        tracksContainer.style.display = 'none';
        currentlyViewedPlaylistId = null;
        event.target.textContent = "View Tracks";
    }
}

function displayTracksForPlaylist(playlistId, containerElement) {
    const playlist = playlists.find(p => p.id === playlistId);
    containerElement.innerHTML = ''; 

    if (!playlist || playlist.tracks.length === 0) {
        containerElement.innerHTML = '<p class="empty-playlist-message">This playlist is empty.</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.classList.add('playlist-track-list');
    playlist.tracks.forEach((track, index) => { // track.title and track.artist are RAW
        const trackItem = document.createElement('li');
        trackItem.classList.add('playlist-track-item');
        // Escape track title and artist here for safe display in innerHTML
        trackItem.innerHTML = `
            <span class="track-details">${escapeHTML(track.title)} - ${escapeHTML(track.artist)}</span>
            <div class="track-item-buttons">
                <button class="play-track-from-playlist-btn" data-playlist-id="${playlist.id}" data-track-index="${index}">Play</button>
                <button class="remove-track-btn" data-playlist-id="${playlist.id}" data-track-id="${track.videoId}">Remove</button>
            </div>
        `;
        ul.appendChild(trackItem);
    });
    containerElement.appendChild(ul);

    containerElement.querySelectorAll('.play-track-from-playlist-btn').forEach(button => {
        button.removeEventListener('click', playTrackFromPlaylistHandler);
        button.addEventListener('click', playTrackFromPlaylistHandler);
    });

    containerElement.querySelectorAll('.remove-track-btn').forEach(button => {
        button.removeEventListener('click', removeTrackFromPlaylistHandler);
        button.addEventListener('click', removeTrackFromPlaylistHandler);
    });
}

function playTrackFromPlaylistHandler(e) {
    const pId = e.target.getAttribute('data-playlist-id');
    const tIndex = parseInt(e.target.getAttribute('data-track-index'));
    const playlist = playlists.find(p => p.id === pId);
    if (playlist && playlist.tracks[tIndex]) {
        const tr = playlist.tracks[tIndex]; // tr.title and tr.artist are RAW
        currentPlayingPlaylist = { playlistId: pId, trackIndex: tIndex };
        playVideo(tr.videoId, tr.title, tr.artist);
    }
}

function removeTrackFromPlaylistHandler(e) {
    const pId = e.target.getAttribute('data-playlist-id');
    const videoIdToRemove = e.target.getAttribute('data-track-id');
    const tracksContainer = document.getElementById(`tracks-for-${pId}`); 

    removeTrackFromPlaylist(pId, videoIdToRemove);
    if (tracksContainer && currentlyViewedPlaylistId === pId) {
         displayTracksForPlaylist(pId, tracksContainer);
    }
    displayUserPlaylists();
}


function handleDeletePlaylist(event) {
    const playlistId = event.target.getAttribute('data-playlist-id');
    if (confirm('Are you sure you want to delete this playlist?')) {
        playlists = playlists.filter(p => p.id !== playlistId);
        savePlaylists();
        displayUserPlaylists(); 
        if (currentPlayingPlaylist && currentPlayingPlaylist.playlistId === playlistId) {
            currentPlayingPlaylist = null; 
            updateTrackInfoDisplay("No song selected", ""); 
            if(player && typeof player.stopVideo === 'function') player.stopVideo(); 
            playPauseButton.textContent = '▶';
            currentTimeElement.textContent = formatTime(0);
            durationElement.textContent = formatTime(0);
            progressBar.value = 0;
        }
        const tracksContainer = document.getElementById(`tracks-for-${playlistId}`);
        if (tracksContainer && tracksContainer.style.display !== 'none') {
            tracksContainer.style.display = 'none';
            currentlyViewedPlaylistId = null;
        }
    }
}

function removeTrackFromPlaylist(playlistId, videoId) {
    const playlist = playlists.find(p => p.id === playlistId);
    if (playlist) {
        const trackIndexToRemove = playlist.tracks.findIndex(track => track.videoId === videoId);
        playlist.tracks = playlist.tracks.filter(track => track.videoId !== videoId);
        savePlaylists();
        
        if (currentPlayingPlaylist && currentPlayingPlaylist.playlistId === playlistId && currentPlayingPlaylist.trackIndex === trackIndexToRemove) {
            if (playlist.tracks.length > 0) {
                currentPlayingPlaylist.trackIndex = Math.min(trackIndexToRemove, playlist.tracks.length - 1);
                 if (currentPlayingPlaylist.trackIndex >= playlist.tracks.length) currentPlayingPlaylist.trackIndex = 0;

                const nextTrack = playlist.tracks[currentPlayingPlaylist.trackIndex]; // raw title/artist
                playVideo(nextTrack.videoId, nextTrack.title, nextTrack.artist);
            } else {
                currentPlayingPlaylist = null;
                updateTrackInfoDisplay("No song selected", "");
                if(player && typeof player.stopVideo === 'function') player.stopVideo();
                playPauseButton.textContent = '▶';
                currentTimeElement.textContent = formatTime(0);
                durationElement.textContent = formatTime(0);
                progressBar.value = 0;
            }
        } else if (currentPlayingPlaylist && currentPlayingPlaylist.playlistId === playlistId && trackIndexToRemove < currentPlayingPlaylist.trackIndex) {
            currentPlayingPlaylist.trackIndex--;
        }
    }
}


// --- Playlist Creation Modal Logic ---
if (createPlaylistButton) {
    createPlaylistButton.addEventListener('click', () => {
        playlistCreationModal.style.display = 'block';
        newPlaylistNameInput.value = ''; 
        newPlaylistNameInput.focus();
    });
}

if (savePlaylistButton) {
    savePlaylistButton.addEventListener('click', () => {
        const playlistName = newPlaylistNameInput.value.trim(); // Name itself doesn't need escaping for storage
        if (playlistName) {
            const newPlaylist = {
                id: Date.now().toString(),
                name: playlistName, // Store raw name
                tracks: []
            };
            playlists.push(newPlaylist);
            savePlaylists();
            displayUserPlaylists(); // Will escape name for display
            newPlaylistNameInput.value = '';
            playlistCreationModal.style.display = 'none';
        } else {
            alert('Playlist name cannot be empty.');
        }
    });
}

if (cancelPlaylistButton) {
    cancelPlaylistButton.addEventListener('click', () => {
        newPlaylistNameInput.value = '';
        playlistCreationModal.style.display = 'none';
    });
}


// --- Modify `displayResults` for escaping logic ---
function displayResults(videos) { 
    resultsContainer.innerHTML = ''; 
    if (!videos || videos.length === 0) {
        resultsContainer.innerHTML = '<p>No videos found.</p>';
        return;
    }
    videos.forEach(video => {
        const videoId = video.id.videoId;
        const rawTitle = video.snippet.title; // Store raw title
        const rawArtist = video.snippet.channelTitle; // Store raw artist (channel title)
        const thumbnailUrl = video.snippet.thumbnails.medium.url;

        const resultItem = document.createElement('div');
        resultItem.classList.add('result-item');

        // Escape for display in innerHTML, but store raw in data attributes
        resultItem.innerHTML = `
            <img src="${thumbnailUrl}" alt="${escapeHTML(rawTitle.substring(0, 50))}">
            <h3>${escapeHTML(rawTitle.length > 50 ? rawTitle.substring(0,50) + "..." : rawTitle)}</h3>
            <p>${escapeHTML(rawArtist)}</p>
            <button class="play-search-result-btn" data-video-id="${videoId}" data-title="${rawTitle}" data-artist="${rawArtist}">Play</button>
            <button class="add-to-playlist-btn" data-video-id="${videoId}" data-title="${rawTitle}" data-artist="${rawArtist}">Add to Playlist</button>
        `;
        // Note: data-title and data-artist now store RAW strings.
        
        resultItem.querySelector('.play-search-result-btn').addEventListener('click', (e) => {
            currentPlayingPlaylist = null; 
            playVideo( // playVideo expects raw strings
                e.target.getAttribute('data-video-id'),
                e.target.getAttribute('data-title'), 
                e.target.getAttribute('data-artist')
            );
        });
        
        resultItem.querySelector('.add-to-playlist-btn').addEventListener('click', (e) => {
            const trackData = { // trackData will contain raw strings from data attributes
                videoId: e.target.getAttribute('data-video-id'),
                title: e.target.getAttribute('data-title'), 
                artist: e.target.getAttribute('data-artist') 
            };
            promptAddTrackToPlaylist(trackData); // trackData contains raw strings
        });
        resultsContainer.appendChild(resultItem);
    });
}

// promptAddTrackToPlaylist receives trackData with RAW title/artist
function promptAddTrackToPlaylist(trackData) {
    if (playlists.length === 0) {
        alert("No playlists exist. Please create one in the Library first.");
        showPage('library'); 
        if(createPlaylistButton) createPlaylistButton.click(); 
        return;
    }
    
    // Escape playlist names for display in the prompt
    const playlistNames = playlists.map((p, i) => `${i + 1}. ${escapeHTML(p.name)}`).join('\n');
    const choice = prompt(`Add to which playlist? (Enter number or name)\n${playlistNames}`);
    
    if (choice === null) return; 

    let selectedPlaylist = null;
    if (!isNaN(parseInt(choice)) && parseInt(choice) > 0 && parseInt(choice) <= playlists.length) {
        selectedPlaylist = playlists[parseInt(choice) - 1];
    } else {
        // Compare with raw playlist names
        selectedPlaylist = playlists.find(p => p.name.toLowerCase() === choice.toLowerCase());
    }

    if (selectedPlaylist) {
        // trackData.title and trackData.artist are RAW. selectedPlaylist.name is RAW.
        if (selectedPlaylist.tracks.find(t => t.videoId === trackData.videoId)) {
            alert(`"${escapeHTML(trackData.title)}" is already in "${escapeHTML(selectedPlaylist.name)}".`);
            return;
        }
        selectedPlaylist.tracks.push(trackData); // Add raw trackData to playlist
        savePlaylists(); // Playlists now store raw trackData
        alert(`"${escapeHTML(trackData.title)}" added to "${escapeHTML(selectedPlaylist.name)}".`);
        if (currentlyViewedPlaylistId === selectedPlaylist.id) { 
            const tracksContainer = document.getElementById(`tracks-for-${selectedPlaylist.id}`);
            if (tracksContainer) displayTracksForPlaylist(selectedPlaylist.id, tracksContainer); // Will escape for display
        }
        displayUserPlaylists(); // Will escape playlist names for display
    } else {
        alert("Playlist not found.");
    }
}

// --- Event Listeners for Player Controls ---
searchButton.addEventListener('click', () => {
    const query = searchBar.value.trim();
    if (query) {
        searchYouTube(query);
    } else {
        resultsContainer.innerHTML = '<p>Please enter a search term.</p>';
    }
});

searchBar.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        searchButton.click();
    }
});

playPauseButton.addEventListener('click', () => {
    if (!player || typeof player.getPlayerState !== 'function') {
        console.log("Player not ready for play/pause.")
        return;
    }
    const playerState = player.getPlayerState();
    if (playerState == YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } else if (playerState == YT.PlayerState.PAUSED || playerState == YT.PlayerState.CUED || playerState == YT.PlayerState.ENDED || playerState == YT.PlayerState.UNSTARTED) {
        player.playVideo();
    }
});

volumeSlider.addEventListener('input', (e) => {
    if (player && typeof player.setVolume === 'function') {
        player.setVolume(e.target.value);
    }
});

if (progressBar) {
    progressBar.addEventListener('input', () => { 
        if (player && typeof player.seekTo === 'function' && player.getPlayerState() !== YT.PlayerState.UNSTARTED && player.getPlayerState() !== -1 ) { 
            if (progressUpdateInterval) { 
                clearInterval(progressUpdateInterval);
                progressUpdateInterval = null; 
            }
            const newTime = parseFloat(progressBar.value);
            currentTimeElement.textContent = formatTime(newTime); 
        }
    });
    progressBar.addEventListener('change', () => { 
        if (player && typeof player.seekTo === 'function' && player.getPlayerState() !== YT.PlayerState.UNSTARTED && player.getPlayerState() !== -1) {
            const newTime = parseFloat(progressBar.value);
            player.seekTo(newTime, true); 
            if (player.getPlayerState() === YT.PlayerState.PLAYING) {
                if (progressUpdateInterval) clearInterval(progressUpdateInterval); 
                progressUpdateInterval = setInterval(() => {
                    const currentTime = player.getCurrentTime();
                    currentTimeElement.textContent = formatTime(currentTime);
                    progressBar.value = currentTime;
                }, 1000);
            } else if (player.getPlayerState() === YT.PlayerState.PAUSED) {
                 currentTimeElement.textContent = formatTime(newTime);
            }
        }
    });
}

if (nextButton) {
    nextButton.addEventListener('click', () => {
        if (currentPlayingPlaylist) {
            const playlist = playlists.find(p => p.id === currentPlayingPlaylist.playlistId);
            if (playlist && playlist.tracks.length > 0) {
                currentPlayingPlaylist.trackIndex++;
                if (currentPlayingPlaylist.trackIndex >= playlist.tracks.length) {
                    currentPlayingPlaylist.trackIndex = 0; 
                }
                const nextTrack = playlist.tracks[currentPlayingPlaylist.trackIndex]; // raw title/artist
                playVideo(nextTrack.videoId, nextTrack.title, nextTrack.artist);
            }
        } else {
            console.log("Next button: No active playlist.");
        }
    });
}

if (prevButton) {
    prevButton.addEventListener('click', () => {
        if (currentPlayingPlaylist) {
            const playlist = playlists.find(p => p.id === currentPlayingPlaylist.playlistId);
            if (playlist && playlist.tracks.length > 0) {
                currentPlayingPlaylist.trackIndex--;
                if (currentPlayingPlaylist.trackIndex < 0) {
                    currentPlayingPlaylist.trackIndex = playlist.tracks.length - 1; 
                }
                const prevTrack = playlist.tracks[currentPlayingPlaylist.trackIndex]; // raw title/artist
                playVideo(prevTrack.videoId, prevTrack.title, prevTrack.artist);
            }
        } else {
             console.log("Previous button: No active playlist.");
        }
    });
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    loadPlaylists(); 
    showPage('search'); 
    
    const searchNavLink = document.querySelector('.nav-link[data-page="search"]');
    if(searchNavLink) searchNavLink.classList.add('active');

    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
        const warning = document.createElement('p');
        warning.textContent = 'ATTENTION: YouTube API Key is not configured. Search will not work. Please edit script.js to add your key.';
        warning.style.color = 'yellow';
        warning.style.textAlign = 'center';
        warning.style.padding = '10px';
        warning.style.backgroundColor = 'red';
        if (document.body) { 
            document.body.insertBefore(warning, document.body.firstChild);
        } else { 
            window.addEventListener('DOMContentLoaded', () => { 
                document.body.insertBefore(warning, document.body.firstChild);
            });
        }
    }
    console.log("Script.js loaded. Player, search, and playlist functionalities active. YouTube API Key needs to be configured. HTML escaping refactored.");
});

console.log("HTML escaping logic refactored for consistency.");
