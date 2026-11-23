document.addEventListener("DOMContentLoaded", () => {
  const video = document.getElementById("liveVideo");
  const channelGrid = document.getElementById("channelGrid");
  const categoryStrip = document.getElementById("categoryStrip");
  const searchInput = document.getElementById("searchInput");
  const langFilter = document.getElementById("langFilter");
  const channelCount = document.getElementById("channelCount");
  const currentCategoryTitle = document.getElementById("currentCategoryTitle");

  // Player controls & overlays
  const btnPlayPause = document.getElementById("btnPlayPause");
  const btnMute = document.getElementById("btnMute");
  const btnPip = document.getElementById("btnPip");
  const btnFullscreen = document.getElementById("btnFullscreen");
  const btnToggleProxy = document.getElementById("btnToggleProxy");
  const playPauseOverlay = document.getElementById("playPauseOverlay");

  // Metadata Display
  const overlayChannelName = document.getElementById("overlayChannelName");
  const channelTitle = document.getElementById("channelTitle");
  const showTitle = document.getElementById("showTitle");
  const showTiming = document.getElementById("showTiming");
  const channelCategory = document.getElementById("channelCategory");
  const channelAvatar = document.getElementById("channelAvatar");
  const proxyStatus = document.getElementById("proxyStatus");
  const epgCurrentName = document.getElementById("epgCurrentName");

  // Modal elements
  const playlistModal = document.getElementById("playlistModal");
  const btnOpenPlaylistModal = document.getElementById("btnOpenPlaylistModal");
  const mobPlaylistOpen = document.getElementById("mobPlaylistOpen");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const btnLoadPlaylist = document.getElementById("btnLoadPlaylist");
  const playlistUrlInput = document.getElementById("playlistUrlInput");

  let currentCategory = "All";
  let currentLanguage = "All";
  let activeChannel = null;
  let hlsInstance = null;
  let useProxy = false;

  // Fetch Channels from Flask backend
  async function fetchChannels() {
    try {
      const q = encodeURIComponent(searchInput.value.trim());
      const res = await fetch(`/api/channels?category=${currentCategory}&q=${q}`);
      const data = await res.json();

      if (data.status === "success") {
        let channels = data.channels;

        // Apply Language Filter if set
        if (currentLanguage !== "All") {
          channels = channels.filter(c => (c.language || "").toLowerCase().includes(currentLanguage.toLowerCase()));
        }

        channelCount.textContent = `Showing ${channels.length} Channels`;
        renderChannels(channels);

        if (!activeChannel && channels.length > 0) {
          playChannel(channels[0]);
        }
      }
    } catch (err) {
      channelGrid.innerHTML = `<div class="jio-loading-spinner">Unable to load channels. Ensure Flask backend is running.</div>`;
    }
  }

  // Render Channel Cards
  function renderChannels(channels) {
    channelGrid.innerHTML = "";
    if (channels.length === 0) {
      channelGrid.innerHTML = `<div class="jio-loading-spinner">No channels found matching the filter.</div>`;
      return;
    }

    channels.forEach(ch => {
      const isActive = activeChannel && activeChannel.name === ch.name;
      const card = document.createElement("div");
      card.className = `jio-channel-card ${isActive ? "active" : ""}`;

      const logoHtml = ch.logo
        ? `<img src="${ch.logo}" alt="${ch.name}" onerror="this.onerror=null; this.parentElement.innerText='${ch.logo_char || 'TV'}'" />`
        : `<span>${ch.logo_char || 'TV'}</span>`;

      card.innerHTML = `
        <div class="card-logo-box">${logoHtml}</div>
        <div class="card-details">
          <h3>${ch.name}</h3>
          <p class="card-now-playing">Live Broadcast Program</p>
          <div class="card-badge-row">
            <span class="pill-live"><i class="ri-record-circle-line"></i> LIVE</span>
            <span class="pill-genre">${ch.category || "General"}</span>
          </div>
        </div>
      `;

      card.addEventListener("click", () => playChannel(ch));
      channelGrid.appendChild(card);
    });
  }

  // Play Stream through HLS.js or HTML5 native
  function playChannel(channel) {
    activeChannel = channel;

    // Update UI elements
    overlayChannelName.textContent = channel.name;
    channelTitle.textContent = channel.name;
    showTitle.textContent = `Live Telecast - ${channel.category || 'General'}`;
    channelCategory.textContent = channel.category || 'General';
    epgCurrentName.textContent = `Streaming ${channel.name} 24/7`;
    proxyStatus.textContent = useProxy ? "FLASK PROXY" : "DIRECT HLS";

    if (channel.logo) {
      channelAvatar.innerHTML = `<img src="${channel.logo}" alt="${channel.name}" onerror="this.onerror=null; this.parentElement.innerText='${channel.logo_char || 'TV'}'" />`;
    } else {
      channelAvatar.innerHTML = `<span>${channel.logo_char || 'TV'}</span>`;
    }

    // Refresh active state on cards
    document.querySelectorAll(".jio-channel-card").forEach(c => c.classList.remove("active"));
    const cards = channelGrid.querySelectorAll(".jio-channel-card");
    const selectedCard = Array.from(cards).find(el => el.querySelector("h3").textContent === channel.name);
    if (selectedCard) selectedCard.classList.add("active");

    // Build URL (Direct or Proxied through Flask)
    let streamUrl = channel.stream_url;
    if (useProxy) {
      streamUrl = `/proxy/stream?url=${encodeURIComponent(channel.stream_url)}`;
    }

    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }

    if (streamUrl.includes(".m3u8") && Hls.isSupported()) {
      hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsInstance.loadSource(streamUrl);
      hlsInstance.attachMedia(video);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => console.log("Autoplay blocked:", e));
      });
      hlsInstance.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal && !useProxy) {
          console.warn("Direct stream restricted by CORS, auto-switching to Flask proxy...");
          useProxy = true;
          playChannel(activeChannel);
        }
      });
    } else {
      video.src = streamUrl;
      video.play().catch(e => console.log("Autoplay blocked:", e));
    }
  }

  // Video Controls
  function togglePlay() {
    if (video.paused) {
      video.play();
      btnPlayPause.innerHTML = `<i class="ri-pause-line"></i>`;
      playPauseOverlay.innerHTML = `<i class="ri-pause-fill icon-huge"></i>`;
    } else {
      video.pause();
      btnPlayPause.innerHTML = `<i class="ri-play-line"></i>`;
      playPauseOverlay.innerHTML = `<i class="ri-play-fill icon-huge"></i>`;
    }
  }

  btnPlayPause.addEventListener("click", togglePlay);
  playPauseOverlay.addEventListener("click", togglePlay);

  btnMute.addEventListener("click", () => {
    video.muted = !video.muted;
    btnMute.innerHTML = video.muted ? `<i class="ri-volume-mute-line"></i>` : `<i class="ri-volume-up-line"></i>`;
  });

  btnToggleProxy.addEventListener("click", () => {
    useProxy = !useProxy;
    alert(`Streaming mode: ${useProxy ? 'Flask Proxy (Bypass CORS)' : 'Direct Connection'}`);
    if (activeChannel) playChannel(activeChannel);
  });

  btnPip.addEventListener("click", async () => {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else if (document.pictureInPictureEnabled) await video.requestPictureInPicture();
  });

  btnFullscreen.addEventListener("click", () => {
    const box = document.getElementById("videoBox");
    if (!document.fullscreenElement) box.requestFullscreen();
    else document.exitFullscreen();
  });

  // Jio Category Filter Tabs
  categoryStrip.querySelectorAll(".cat-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      categoryStrip.querySelectorAll(".cat-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentCategory = tab.getAttribute("data-cat");
      currentCategoryTitle.textContent = currentCategory === "All" ? "All Live Channels" : `${currentCategory} Channels`;
      fetchChannels();
    });
  });

  // Language filter
  langFilter.addEventListener("change", (e) => {
    currentLanguage = e.target.value;
    fetchChannels();
  });

  // Search filter
  let searchTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(fetchChannels, 250);
  });

  // Modal Handlers
  const toggleModal = (show) => playlistModal.classList.toggle("hidden", !show);
  btnOpenPlaylistModal.addEventListener("click", () => toggleModal(true));
  if (mobPlaylistOpen) mobPlaylistOpen.addEventListener("click", () => toggleModal(true));
  btnCloseModal.addEventListener("click", () => toggleModal(false));

  btnLoadPlaylist.addEventListener("click", async () => {
    const newUrl = playlistUrlInput.value.trim();
    if (!newUrl) return alert("Please enter a valid M3U playlist URL");

    btnLoadPlaylist.textContent = "Loading...";
    try {
      const res = await fetch("/api/load_m3u", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl })
      });
      const data = await res.json();
      if (data.status === "success") {
        alert(`Successfully imported ${data.total_channels} channels!`);
        toggleModal(false);
        activeChannel = null;
        fetchChannels();
      } else {
        alert("Failed to parse playlist: " + data.message);
      }
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      btnLoadPlaylist.textContent = "Load Playlist";
    }
  });

  // Initial load
  fetchChannels();
});