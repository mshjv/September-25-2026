const VIDEOS = [
  { id: "neymar", title: "neymar", src:"neymar%20video/neymar.mp4", thumb: "ney.jpg", duration: "03:42", views: 0, likes: 0 },
  { id: "neymar 2", title: "Neymar 2", src: "neymar%20video/neymar.mp4", thumb: "ney.jpg", duration: "04:14", views: 0, likes: 0 },
  { id: "neymar 3", title: "Neymar 3", src: "neymar%20video/neymar.mp4", thumb: "ney.jpg", duration: "02:58", views: 0, likes: 0 }
];

const CATEGORIES = [
  { name: "American", videos: VIDEOS },
  { name: "Chinese", videos: VIDEOS }
];

const feedEl = document.getElementById("feed");
const watchEl = document.getElementById("watch");
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");
const videoUploadInput = document.getElementById("videoUpload");
const uploadButton = document.getElementById("uploadButton");
const uploadStatus = document.getElementById("uploadStatus");
const sidebarRecommendationsEl = document.getElementById("sidebarRecommendations");
const sidebarRecommendationListEl = document.getElementById("sidebarRecommendationList");
const navItems = document.querySelectorAll(".nav-item");
const pageUrl = new URL(window.location.href);
const isWatchPage = pageUrl.pathname.endsWith("/watch.html");

const ALL_VIDEOS = VIDEOS;
const VIDEO_DB_NAME = "virtube-video-library";
const VIDEO_DB_VERSION = 1;
const VIDEO_STORE_NAME = "uploads";

const store = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      
    }
  }
};

const savedCounts = store.get("counts", {});
const counts = savedCounts && typeof savedCounts === "object" && !Array.isArray(savedCounts) ? savedCounts : {};
const savedLiked = store.get("liked", []);
let liked = Array.isArray(savedLiked) ? savedLiked : [];
const savedHistory = store.get("history", []);
let history = Array.isArray(savedHistory) ? savedHistory : [];
let currentPage = pageUrl.searchParams.get("page") || "home";
if (!["home", "trending", "subscription", "liked", "history"].includes(currentPage)) {
  currentPage = "home";
}
searchInput.value = pageUrl.searchParams.get("search") || "";
navItems.forEach((item) => {
  item.classList.toggle("is-active", item.dataset.page === currentPage);
});

ALL_VIDEOS.forEach((video) => {
  const saved = counts[video.id];
  if (saved) {
    video.views = Number(video.views) + Number(saved.views || 0);
    video.likes = Number(video.likes) + Number(saved.likes || 0);
  }
});

function bump(video, field, amount) {
  counts[video.id] = counts[video.id] || { views: 0, likes: 0 };
  counts[video.id][field] = Number(counts[video.id][field] || 0) + Number(amount);
  video[field] = Number(video[field] || 0) + Number(amount);
  store.set("counts", counts);
}

function formatCount(value) {
  const numeric = Number(value) || 0;
  if (numeric < 1000) return String(numeric);
  if (numeric < 1000000) return `${(numeric / 1000).toFixed(numeric >= 10000 ? 0 : 1)}K`;
  return `${(numeric / 1000000).toFixed(1)}M`;
}

function formatViews(value) {
  const numeric = Number(value) || 0;
  return `${formatCount(numeric)} ${numeric === 1 ? "view" : "views"}`;
}

function playIconSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
}

function trendingCategory() {
  return {
    name: "trending",
    videos: [...ALL_VIDEOS].sort((a, b) => Number(b.views) - Number(a.views)).slice(0, 6)
  };
}

function getPageData(page) {
  switch (page) {
    case "trending":
      return [trendingCategory()];
    case "subscription":
      return CATEGORIES;
    case "liked":
      return [{ name: "liked videos", videos: ALL_VIDEOS.filter((video) => liked.includes(video.id)) }];
    case "history": {
      const uniqueHistory = [];
      const seen = new Set();
      history.forEach((id) => {
        if (!seen.has(id)) {
          seen.add(id);
          const match = ALL_VIDEOS.find((video) => video.id === id);
          if (match) uniqueHistory.push(match);
        }
      });
      return [{ name: "history", videos: uniqueHistory }];
    }
    default:
      return [trendingCategory(), ...CATEGORIES];
  }
}

function getRecommended(video) {
  const cat = CATEGORIES.find((category) => category.videos.includes(video));
  const same = cat ? cat.videos.filter((item) => item !== video) : [];
  const others = ALL_VIDEOS
    .filter((item) => item !== video && !same.includes(item))
    .sort((a, b) => Number(b.views) - Number(a.views));

  return [...same, ...others].slice(0, 8);
}

function openVideoDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(VIDEO_DB_NAME, VIDEO_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(VIDEO_STORE_NAME)) {
        database.createObjectStore(VIDEO_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open the video library."));
  });
}

async function getUploadedVideos() {
  const database = await openVideoDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(VIDEO_STORE_NAME, "readonly");
    const request = transaction.objectStore(VIDEO_STORE_NAME).getAll();
    request.onsuccess = () => {
      database.close();
      resolve(request.result);
    };
    request.onerror = () => {
      database.close();
      reject(request.error || new Error("Could not load uploaded videos."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("Loading uploaded videos was interrupted."));
    };
  });
}

async function saveUploadedVideo(video) {
  const database = await openVideoDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(VIDEO_STORE_NAME, "readwrite");
    transaction.objectStore(VIDEO_STORE_NAME).put(video);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Could not save the uploaded video."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("Saving the uploaded video was interrupted."));
    };
  });
}

function getVideoDuration(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      URL.revokeObjectURL(objectUrl);
      resolve(duration > 0 ? formatDuration(duration) : "Video");
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve("Video");
    };
    video.src = objectUrl;
  });
}

function formatDuration(seconds) {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function createVideoId() {
  return `upload-${window.crypto.randomUUID()}`;
}

function setUploadStatus(message, isError = false) {
  uploadStatus.textContent = message;
  uploadStatus.classList.toggle("is-error", isError);
}

async function handleVideoUpload() {
  const file = videoUploadInput.files[0];
  videoUploadInput.value = "";
  if (!file) return;

  const looksLikeVideo = file.type.startsWith("video/") || /\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i.test(file.name);
  if (!looksLikeVideo) {
    setUploadStatus("Choose a video file to upload.", true);
    return;
  }
  uploadButton.disabled = true;
  setUploadStatus(`Saving ${file.name}…`);
  try {
    const video = {
      id: createVideoId(),
      title: file.name.replace(/\.[^.]+$/, "") || "Untitled video",
      src: "",
      thumb: "ney.jpg",
      duration: await getVideoDuration(file),
      views: 0,
      likes: 0,
      file
    };
    await saveUploadedVideo(video);
    video.src = URL.createObjectURL(file);
    delete video.file;
    ALL_VIDEOS.push(video);
    setUploadStatus(`“${video.title}” is ready to watch.`);
    if (!isWatchPage) render();
  } catch (error) {
    console.error("Video upload failed:", error);
    setUploadStatus(error.message || "Could not save this video in the browser.", true);
  } finally {
    uploadButton.disabled = false;
  }
}

function goToVideo(video) {
  window.location.href = `watch.html?video=${encodeURIComponent(video.id)}`;
}

function buildCard(video) {
  const card = document.createElement("div");
  card.className = "card";
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.setAttribute("aria-label", video.title || "Untitled video");

  card.innerHTML = `
    <div class="thumb" aria-hidden="true">
      <div class="thumb-play">${playIconSvg()}</div>
      <span class="thumb-duration">${video.duration}</span>
    </div>
    <div class="card-title"></div>
    <div class="card-meta">
      <span>${formatViews(video.views)}</span>
      <span>${formatCount(video.likes)} likes</span>
    </div>
  `;

  card.querySelector(".card-title").textContent = video.title || "Untitled video";

  const thumb = card.querySelector(".thumb");
  if (video.thumb) {
    thumb.style.backgroundImage = `url("${video.thumb}")`;
  }

  card.addEventListener("click", () => goToVideo(video));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      goToVideo(video);
    }
  });

  return card;
}

function buildCategory(category) {
  const section = document.createElement("section");
  section.className = "category";

  const heading = document.createElement("h2");
  heading.className = "category-header";
  heading.textContent = category.name;
  section.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "category-grid";
  category.videos.forEach((video) => grid.appendChild(buildCard(video)));
  section.appendChild(grid);

  return section;
}

function render() {
  feedEl.innerHTML = "";
  const query = searchInput.value.trim().toLowerCase();
  let anyResults = false;

  getPageData(currentPage).forEach((category) => {
    const matches = query
      ? category.videos.filter((video) => {
          const haystack = `${video.title || ""} ${category.name || ""}`.toLowerCase();
          return haystack.includes(query);
        })
      : category.videos;

    if (matches.length === 0) return;
    anyResults = true;
    feedEl.appendChild(buildCategory({ name: category.name, videos: matches }));
  });

  if (!anyResults) {
    const emptyState = document.createElement("div");
    emptyState.className = "no-results";
    emptyState.textContent = query ? `No videos found for "${searchInput.value}".` : "Nothing here yet.";
    feedEl.appendChild(emptyState);
  }
}

function showWatch(video) {
  document.title = `${video.title || "Video"} | VirTube`;
  feedEl.hidden = true;
  watchEl.hidden = false;
  sidebarRecommendationsEl.hidden = false;
  document.body.classList.add("is-watching");

  bump(video, "views", 1);
  history = [video.id, ...history.filter((id) => id !== video.id)].slice(0, 50);
  store.set("history", history);

  watchEl.innerHTML = `
    <div class="watch-main">
      <div class="watch-player"></div>
      <h1 class="watch-title"></h1>
      <div class="watch-actions">
        <span class="watch-views"></span>
        <button id="likeBtn" type="button"></button>
      </div>
    </div>
  `;

  watchEl.querySelector(".watch-title").textContent = video.title || "Untitled video";

  const playerBox = watchEl.querySelector(".watch-player");
  if (video.src) {
    const player = document.createElement("video");
    player.src = video.src;
    player.controls = true;
    player.autoplay = true;
    player.preload = "metadata";
    if (video.thumb) player.poster = video.thumb;
    playerBox.appendChild(player);
  } else {
    playerBox.textContent = "No video file added yet";
  }

  const viewsEl = watchEl.querySelector(".watch-views");
  const likeBtn = watchEl.querySelector("#likeBtn");

  function updateStats() {
    const isLiked = liked.includes(video.id);
    viewsEl.textContent = `${Number(video.views).toLocaleString()} ${Number(video.views) === 1 ? "view" : "views"}`;
    likeBtn.textContent = `${isLiked ? "♥ Liked" : "♡ Like"} · ${formatCount(video.likes)}`;
    likeBtn.classList.toggle("is-liked", isLiked);
  }

  likeBtn.addEventListener("click", () => {
    if (liked.includes(video.id)) {
      liked = liked.filter((id) => id !== video.id);
      bump(video, "likes", -1);
    } else {
      liked.push(video.id);
      bump(video, "likes", 1);
    }
    store.set("liked", liked);
    updateStats();
  });

  updateStats();

  sidebarRecommendationListEl.innerHTML = "";
  getRecommended(video).forEach((item) => {
    const recItem = document.createElement("div");
    recItem.className = "sidebar-recommendation";
    recItem.tabIndex = 0;
    recItem.setAttribute("role", "link");
    recItem.setAttribute("aria-label", `Watch ${item.title || "Untitled video"}`);
    recItem.innerHTML = `
      <div class="sidebar-rec-thumb"></div>
      <div class="sidebar-rec-copy">
        <div class="sidebar-rec-title"></div>
        <div class="sidebar-rec-meta"></div>
      </div>
    `;

    recItem.querySelector(".sidebar-rec-title").textContent = item.title || "Untitled video";
    recItem.querySelector(".sidebar-rec-meta").textContent = `${formatViews(item.views)} · ${item.duration}`;

    if (item.thumb) {
      recItem.querySelector(".sidebar-rec-thumb").style.backgroundImage = `url("${item.thumb}")`;
    }

    recItem.addEventListener("click", () => goToVideo(item));
    recItem.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        goToVideo(item);
      }
    });
    sidebarRecommendationListEl.appendChild(recItem);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showFeed() {
  watchEl.innerHTML = "";
  watchEl.hidden = true;
  sidebarRecommendationsEl.hidden = true;
  sidebarRecommendationListEl.innerHTML = "";
  document.body.classList.remove("is-watching");
  feedEl.hidden = false;
  render();
}

function route() {
  if (isWatchPage) {
    const videoId = pageUrl.searchParams.get("video");
    const video = ALL_VIDEOS.find((item) => item.id === videoId);
    if (video) {
      showWatch(video);
    } else {
      window.location.replace("index.html");
    }
    return;
  }
  showFeed();
}

function backToFeed() {
  if (isWatchPage) {
    const search = searchInput.value.trim();
    window.location.href = `index.html${search ? `?search=${encodeURIComponent(search)}` : ""}`;
    return;
  }
  showFeed();
}

searchInput.addEventListener("input", () => {
  if (!isWatchPage) render();
});
searchInput.addEventListener("keydown", (event) => {
  if (isWatchPage && event.key === "Enter") backToFeed();
});
searchClear.addEventListener("click", () => {
  searchInput.value = "";
  backToFeed();
  searchInput.focus();
});

uploadButton.addEventListener("click", () => videoUploadInput.click());
videoUploadInput.addEventListener("change", handleVideoUpload);

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    currentPage = item.dataset.page;
    if (isWatchPage) {
      window.location.href = `index.html?page=${encodeURIComponent(currentPage)}`;
      return;
    }
    navItems.forEach((navItem) => navItem.classList.remove("is-active"));
    item.classList.add("is-active");
    backToFeed();
  });
});

async function initialize() {
  try {
    const uploadedVideos = await getUploadedVideos();
    uploadedVideos.forEach((video) => {
      if (!video || !video.id || !video.file || ALL_VIDEOS.some((item) => item.id === video.id)) return;
      const saved = counts[video.id];
      if (saved) {
        video.views = Number(video.views) + Number(saved.views || 0);
        video.likes = Number(video.likes) + Number(saved.likes || 0);
      }
      video.src = URL.createObjectURL(video.file);
      ALL_VIDEOS.push(video);
    });
  } catch (error) {
    console.error("Could not initialize the video library:", error);
    setUploadStatus("Saved uploads could not be loaded in this browser.", true);
  } finally {
    route();
  }
}

initialize();
