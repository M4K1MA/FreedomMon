const sb = supabase.createClient(
  "https://turdhxbrlxfxzedhspxw.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cmRoeGJybHhmeHplZGhzcHh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwNzQ3ODUsImV4cCI6MjA3MjY1MDc4NX0.uUT8V2_7zvPJDRvIzkvE4gnv61-y1YoDgBBDNBjr-mg"
);
const BUCKET = "media";

const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menuBtn');
const closeSidebar = document.getElementById('closeSidebar');
const grid = document.getElementById('grid');
const q = document.getElementById('q');
const navLinks = document.querySelectorAll('.nav a');
const toggleTheme = document.getElementById('toggleTheme');

const uploaderModal = document.getElementById('uploaderModal');
const openUploader = document.getElementById('openUploader');
const closeUploader = document.getElementById('closeUploader');
const chooseFile = document.getElementById('chooseFile');
const fileInput = document.getElementById('file');
const fileName = document.getElementById('fileName');
const titleInput = document.getElementById('title');
const descInput = document.getElementById('description');
const uploaderInput = document.getElementById('uploaderName');
const uploadBtn = document.getElementById('upload');
const statusEl = document.getElementById('status');
const progressBar = document.getElementById('progressBar');

const modal = document.getElementById('detailModal');
const closeDetail = document.getElementById('closeDetail');
const viewer = document.getElementById('viewer');
const dTitle = document.getElementById('dTitle');
const dDesc = document.getElementById('dDesc');
const dUser = document.getElementById('dUser');
const dDate = document.getElementById('dDate');
const downloadBtn = document.getElementById('downloadBtn');

const commentsBox = document.getElementById('comments');
const cAuthor = document.getElementById('cAuthor');
const cContent = document.getElementById('cContent');
const sendComment = document.getElementById('sendComment');

let postsCache = [];
let currentFilter = 'all';
let currentPost = null;

const fmt = d => new Date(d).toLocaleString('id-ID');
const esc = s => String(s || '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const getMediaType = m => {
  if (m?.startsWith('image/')) return 'image';
  if (m?.startsWith('video/')) return 'video';
  if (m?.startsWith('audio/')) return 'audio';
  if (m?.includes('pdf') || m?.includes('word') || m?.includes('text')) return 'document';
  return 'other';
};

function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

// --- Render & Fetch Data ---
function cardHTML(p) {
  const fileType = p.type || getMediaType(p.mime_type);
  let mediaContent = '';
  if (fileType === 'image') mediaContent = `<img class="media-thumb" src="${esc(p.url)}" alt="${esc(p.title)}">`;
  else if (fileType === 'video') mediaContent = `<video class="media-thumb" src="${esc(p.url)}" muted preload="metadata"></video>`;
  else if (fileType === 'audio') mediaContent = `<div class="media-thumb"><i class="fa-solid fa-music"></i></div>`;
  else if (fileType === 'document') mediaContent = `<div class="media-thumb"><i class="fa-solid fa-file-lines"></i></div>`;
  else mediaContent = `<div class="media-thumb"><i class="fa-solid fa-box"></i></div>`;

  return `
    <article class="post-card" data-id="${p.id}" data-type="${fileType}">
      ${mediaContent}
      <div class="card-footer">
        <h3 class="card-title">${esc(p.title || '(Tanpa judul)')}</h3>
        <p class="muted">${esc(p.description || '')}</p>
        <div class="card-meta">
          <i class="fa-regular fa-user"></i> ${esc(p.uploader || 'Anonim')}
        </div>
        <div class="card-actions">
          <span class="action-btn"><i class="fa-regular fa-comment"></i> <span>${p.comment_count || 0}</span></span>
        </div>
      </div>
    </article>
  `;
}

function renderPosts(list) {
  const term = q.value.trim().toLowerCase();
  const filtered = list.filter(p => {
    const fileType = p.type || getMediaType(p.mime_type);
    const okType = currentFilter === 'all' || fileType === currentFilter;
    const okTerm = !term || (p.title || '').toLowerCase().includes(term) || (p.description || '').toLowerCase().includes(term);
    return okType && okTerm;
  });

  grid.innerHTML = filtered.map(cardHTML).join('');
  grid.querySelectorAll('.post-card').forEach(card => {
    card.addEventListener('click', () => openDetail(card.dataset.id));
  });
}

async function fetchPosts() {
  const { data, error } = await sb.from('posts').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Gagal mengambil posts:', error);
    return;
  }
  postsCache = data || [];
  renderPosts(postsCache);
}

async function openDetail(id) {
  const post = postsCache.find(p => Number(p.id) === Number(id));
  if (!post) return;
  currentPost = post;

  const fileType = post.type || getMediaType(post.mime_type);
  let viewerContent = '';
  if (fileType === 'image') viewerContent = `<img src="${esc(post.url)}" alt="${esc(post.title)}">`;
  else if (fileType === 'video') viewerContent = `<video src="${esc(post.url)}" controls autoplay playsinline></video>`;
  else if (fileType === 'audio') viewerContent = `<div class="player-container"><audio controls><source src="${esc(post.url)}" type="${esc(post.mime_type)}">Browser tidak mendukung audio.</audio></div>`;
  else if (fileType === 'document') viewerContent = `<iframe src="${esc(post.url)}" style="width:100%;height:70vh;border:none"></iframe>`;
  else viewerContent = `<div class="doc-viewer"><i class="fa-solid fa-box"></i><h3>Pratinjau tidak tersedia</h3><p>Silakan unduh file untuk melihat konten.</p></div>`;

  viewer.innerHTML = viewerContent;
  dTitle.textContent = post.title || '(Tanpa judul)';
  dDesc.textContent = post.description || '';
  dUser.textContent = post.uploader || 'Anonim';
  dDate.textContent = post.created_at ? fmt(post.created_at) : '';
  downloadBtn.href = post.url || '#';

  await loadComments(post.id);
  modal.style.display = 'flex';
}

async function loadComments(postId) {
  const { data, error } = await sb.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: false });
  if (error) {
    console.error('Gagal mengambil komentar:', error);
    commentsBox.innerHTML = '<div class="muted">Error load komentar</div>';
    return;
  }
  if (!data || data.length === 0) {
    commentsBox.innerHTML = '<div class="muted">Belum ada komentar.</div>';
    return;
  }
  commentsBox.innerHTML = data.map(c => `
    <div class="comment-item">
      <div>${esc(c.content)}</div>
      <small class="comment-meta">${esc(c.author || 'Anonim')} • ${fmt(c.created_at)}</small>
    </div>
  `).join('');
}

sendComment.onclick = async () => {
  if (!currentPost) return alert('Pilih postingan terlebih dahulu.');
  const content = (cContent.value || '').trim();
  if (!content) return alert('Komentar tidak boleh kosong!');
  const { error } = await sb.from('comments').insert({ post_id: currentPost.id, content, author: cAuthor.value.trim() || null });
  if (error) {
    console.error('Gagal kirim komentar:', error);
    alert('Gagal kirim komentar');
    return;
  }
  cContent.value = '';
  cAuthor.value = '';
  await loadComments(currentPost.id);
  try {
    const newCount = (currentPost.comment_count || 0) + 1;
    await sb.from('posts').update({ comment_count: newCount }).eq('id', currentPost.id);
    currentPost.comment_count = newCount;
    renderPosts(postsCache);
  } catch (e) {
    console.warn('Gagal update comment_count:', e);
  }
};

uploadBtn.addEventListener('click', async () => {
  try {
    const file = fileInput.files[0];
    if (!file) {
      return alert('Pilih file dulu!');
    }
    statusEl.textContent = 'Mengunggah...';
    progressBar.style.width = '10%';

    const safe = safeFileName(file.name);
    const path = `uploads/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${Date.now()}-${safe}`;

    const { data: uploadData, error: upErr } = await sb.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
    if (upErr) {
      console.error('Upload error:', upErr);
      statusEl.textContent = 'Unggah gagal: ' + upErr.message;
      progressBar.style.width = '0%';
      return;
    }

    const { data: pubData, error: pubErr } = sb.storage.from(BUCKET).getPublicUrl(uploadData.path);
    if (pubErr) {
      console.warn('getPublicUrl err', pubErr);
    }
    const publicUrl = pubData?.publicUrl || '';

    const mime_type = file.type || '';
    const fileType = getMediaType(mime_type);

    const insertObj = {
      title: titleInput.value.trim() || null,
      description: descInput.value.trim() || null,
      uploader: uploaderInput.value.trim() || null,
      url: publicUrl,
      type: fileType,
      file_size: file.size,
      mime_type
    };

    const { error: insErr } = await sb.from('posts').insert(insertObj);
    if (insErr) {
      console.error('DB insert err', insErr);
      statusEl.textContent = 'Simpan DB gagal: ' + insErr.message;
      progressBar.style.width = '0%';
      return;
    }

    statusEl.textContent = 'Unggahan sukses!';
    progressBar.style.width = '100%';

    await fetchPosts();

    setTimeout(() => {
      uploaderModal.style.display = 'none';
      fileInput.value = '';
      fileName.textContent = '';
      titleInput.value = '';
      descInput.value = '';
      uploaderInput.value = '';
      statusEl.textContent = '';
      progressBar.style.width = '0%';
    }, 800);
  } catch (err) {
    console.error('Upload exception', err);
    statusEl.textContent = 'Error: ' + (err.message || err);
    progressBar.style.width = '0%';
  }
});

navLinks.forEach(link => link.addEventListener('click', (e) => {
  e.preventDefault();
  navLinks.forEach(x => x.classList.remove('active'));
  link.classList.add('active');
  currentFilter = link.dataset.filter;
  renderPosts(postsCache);
  if (window.innerWidth <= 900) {
    sidebar.classList.remove('open');
  }
}));

menuBtn?.addEventListener('click', () => sidebar.classList.toggle('open'));
closeSidebar.addEventListener('click', () => sidebar.classList.remove('open'));

openUploader.addEventListener('click', () => {
  uploaderModal.style.display = 'flex';
  if (window.innerWidth <= 900) {
    sidebar.classList.remove('open');
  }
});
closeUploader.addEventListener('click', () => uploaderModal.style.display = 'none');

closeDetail.addEventListener('click', () => modal.style.display = 'none');
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.style.display = 'none';
  }
});
uploaderModal.addEventListener('click', (e) => {
  if (e.target === uploaderModal) {
    uploaderModal.style.display = 'none';
  }
});

q.addEventListener('input', () => renderPosts(postsCache));

chooseFile.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  fileName.textContent = fileInput.files[0]?.name || '';
});

toggleTheme.addEventListener('click', () => {
  const html = document.documentElement;
  const isDark = html.dataset.theme === 'dark';
  html.dataset.theme = isDark ? 'light' : 'dark';
  toggleTheme.innerHTML = isDark ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
});


try {
  sb.channel('comments-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, payload => {
      const newComment = payload.new;
      const postId = newComment.post_id;

      const post = postsCache.find(p => p.id === postId);
      if (post) {
        post.comment_count = (post.comment_count || 0) + 1;

        const card = grid.querySelector(`.post-card[data-id="${postId}"]`);
        if (card) {
          const countSpan = card.querySelector('.action-btn span');
          if (countSpan) {
            countSpan.textContent = post.comment_count;
          }
        }

        if (currentPost && currentPost.id === postId) {
          loadComments(postId);
        }
      }
    })
    .subscribe();
} catch (e) {
  console.warn('Realtime comments init failed (non-fatal):', e);
}


fetchPosts();