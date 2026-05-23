(async function startDesktopLibrary() {
  if (!window.image2Desktop || window.__image2DesktopReady) return;
  window.__image2DesktopReady = true;

  document.title = '董哥 AI 灵感库';
  document.querySelectorAll('.brand-name, .footer-brand-name').forEach((el) => { el.textContent = '董哥 AI 灵感库'; });
  const footerText = document.querySelector('.footer-tagline');
  if (footerText) footerText.textContent = '收藏你喜欢的 AI 图片与提示词，本地导入、分类管理、一键复制。';

  const actions = document.querySelector('.topbar-actions');
  if (actions) {
    actions.innerHTML = '<button type="button" class="desktop-action-btn" id="desktopLibraryBtn">我的图库 <span class="desktop-badge" id="desktopCount">0</span></button><button type="button" class="desktop-action-btn primary" id="desktopAddBtn">＋ 导入图片</button>';
  }

  const desktopCategory = { id: 'mine', name: '我的图库', sub: ['全部'] };
  if (!categories.some((cat) => cat.id === desktopCategory.id)) categories.push(desktopCategory);
  const builtInCount = items.length;
  let library = [];

  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(message) {
    const el = document.createElement('div');
    el.className = 'desktop-toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }
  function syncItems() {
    items.splice(builtInCount, items.length - builtInCount);
    const actual = library.map((entry) => ({
      image: entry.image, cat: 'mine', sub: entry.sub || '未分类', ratio: entry.ratio || '3 / 4',
      prompt: entry.prompt || entry.title || '未填写提示词', localId: entry.id, title: entry.title || '我的素材'
    }));
    desktopCategory.sub = ['全部', ...new Set(actual.map((entry) => entry.sub))];
    items.push(...actual.map((entry) => ({ ...entry, sub: '全部' })), ...actual);
    const count = document.querySelector('#desktopCount');
    if (count) count.textContent = String(library.length);
  }
  function decorateLibraryGrid() {
    if (state.category !== 'mine') return;
    const intro = document.createElement('div');
    intro.className = 'desktop-library-head';
    intro.innerHTML = '<div><h1>我的图库</h1><p>' + (library.length ? '已保存 ' + library.length + ' 张素材，图片和提示词只存放在你的电脑里。' : '这里还没有素材，导入喜欢的图片并填写提示词。') + '</p></div><div class="desktop-library-actions"><button class="desktop-action-btn" type="button" id="desktopFolderBtn">打开保存文件夹</button><button class="desktop-action-btn primary" type="button" id="desktopInlineAddBtn">＋ 导入素材</button></div>';
    grid.prepend(intro);
    intro.querySelector('#desktopInlineAddBtn')?.addEventListener('click', openImportDialog);
    intro.querySelector('#desktopFolderBtn')?.addEventListener('click', () => window.image2Desktop.openFolder());
    if (!library.length) {
      grid.insertAdjacentHTML('beforeend', '<div class="desktop-empty"><strong>把你的第一张灵感图放进来</strong><span>支持 JPG、PNG、WebP 等常见图片格式</span><button type="button" class="desktop-action-btn primary" id="desktopEmptyAdd">导入图片</button></div>');
      grid.querySelector('#desktopEmptyAdd')?.addEventListener('click', openImportDialog);
      return;
    }
    grid.querySelectorAll('.card').forEach((card, index) => {
      const item = visibleItems[index];
      if (!item?.localId) return;
      card.classList.add('desktop-mine-card');
      const overlay = card.querySelector('.card-overlay');
      overlay?.insertAdjacentHTML('afterbegin', '<span class="desktop-view-card-title">' + escapeHtml(item.title) + '</span>');
      card.insertAdjacentHTML('beforeend', '<button type="button" class="desktop-edit-btn" data-edit-id="' + escapeHtml(item.localId) + '">编辑</button>');
    });
  }
  const websiteRenderGrid = renderGrid;
  renderGrid = function desktopRenderGrid() { websiteRenderGrid(); decorateLibraryGrid(); };
  async function loadLibrary(openMine) {
    library = await window.image2Desktop.list();
    syncItems();
    renderPrimary();
    if (openMine) selectCategory('mine', '全部');
    else if (state.category === 'mine') selectCategory('mine', state.sub || '全部');
  }
  function closeModal() { document.querySelector('.desktop-modal-backdrop')?.remove(); }
  async function openImportDialog() {
    const files = await window.image2Desktop.chooseImages();
    if (!files.length) return;
    const backdrop = document.createElement('div');
    backdrop.className = 'desktop-modal-backdrop';
    backdrop.innerHTML = '<form class="desktop-modal"><h2>导入 ' + files.length + ' 张图片</h2><p class="desktop-modal-note">批量导入时，本次填写的分类和提示词会应用到所选图片，保存后还能单独修改。</p><div class="desktop-files-summary">' + escapeHtml(files.map((file) => file.name).join('、')) + '</div><div class="desktop-field"><label>分类</label><input name="sub" value="我的收藏" placeholder="例如：国风海报 / 电商主图 / 人物角色" required></div><div class="desktop-field"><label>提示词（可稍后补充）</label><textarea name="prompt" placeholder="把对应的中文或英文提示词粘贴在这里"></textarea></div><div class="desktop-modal-buttons"><button type="button" class="desktop-action-btn" data-close>取消</button><button class="desktop-action-btn primary" type="submit">保存到图库</button></div></form>';
    document.body.appendChild(backdrop);
    backdrop.querySelector('[data-close]').addEventListener('click', closeModal);
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal(); });
    backdrop.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      const sub = String(form.get('sub') || '').trim() || '未分类';
      const prompt = String(form.get('prompt') || '');
      const entries = files.map((file) => ({ sourcePath: file.path, title: file.name.replace(/\.[^.]+$/, ''), sub, prompt, ratio: '3 / 4' }));
      library = await window.image2Desktop.add(entries);
      syncItems(); closeModal(); selectCategory('mine', '全部'); toast('已导入 ' + entries.length + ' 张图片');
    });
  }
  function openEditDialog(id) {
    const item = library.find((entry) => entry.id === id);
    if (!item) return;
    const backdrop = document.createElement('div');
    backdrop.className = 'desktop-modal-backdrop';
    backdrop.innerHTML = '<form class="desktop-modal"><h2>编辑素材</h2><p class="desktop-modal-note">修改名称、分类和提示词，保存后立即生效。</p><div class="desktop-field"><label>名称</label><input name="title" value="' + escapeHtml(item.title) + '" required></div><div class="desktop-field"><label>分类</label><input name="sub" value="' + escapeHtml(item.sub) + '" required></div><div class="desktop-field"><label>提示词</label><textarea name="prompt">' + escapeHtml(item.prompt) + '</textarea></div><div class="desktop-modal-buttons"><button type="button" class="desktop-action-btn desktop-confirm-danger" data-delete>删除</button><button type="button" class="desktop-action-btn" data-close>取消</button><button class="desktop-action-btn primary" type="submit">保存修改</button></div></form>';
    document.body.appendChild(backdrop);
    backdrop.querySelector('[data-close]').addEventListener('click', closeModal);
    backdrop.querySelector('[data-delete]').addEventListener('click', async () => {
      if (!confirm('确认删除这张图片和提示词吗？')) return;
      library = await window.image2Desktop.remove(id); syncItems(); closeModal(); selectCategory('mine', '全部'); toast('已删除');
    });
    backdrop.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      library = await window.image2Desktop.update({ id, title: String(form.get('title') || '').trim(), sub: String(form.get('sub') || '').trim() || '未分类', prompt: String(form.get('prompt') || ''), ratio: item.ratio || '3 / 4' });
      syncItems(); closeModal(); selectCategory('mine', '全部'); toast('修改已保存');
    });
  }
  grid.addEventListener('click', (event) => {
    const edit = event.target.closest('.desktop-edit-btn');
    if (!edit) return;
    event.preventDefault(); event.stopImmediatePropagation(); openEditDialog(edit.dataset.editId);
  }, true);
  document.querySelector('#desktopAddBtn')?.addEventListener('click', openImportDialog);
  document.querySelector('#desktopLibraryBtn')?.addEventListener('click', () => selectCategory('mine', '全部'));
  await loadLibrary(false);
})();
