'use strict';

const Engine = {

  state: {
    currentChapterId: null,
    currentChapter:   null,
    currentSceneId:   null,
    heroName:         '',
    heroGender:       'm',
    choicesCompleted: 0,
    correctionQueue:  [],
    pendingReveal:    null,
  },

  // ── INIT ──────────────────────────────

  init() {
    this._bindUI();
    const s = Storage.getState();
    if (s.hero_name) {
      this.state.heroName   = s.hero_name;
      this.state.heroGender = s.hero_gender || 'm';
      this.showMap();
    } else {
      this.showScreen('screen-start');
    }
  },

  _bindUI() {
    const nameInput  = document.getElementById('input-name');
    const btnBegin   = document.getElementById('btn-begin');
    const genderBtns = document.querySelectorAll('.gender-btn');

    nameInput.addEventListener('input', () => {
      btnBegin.disabled = nameInput.value.trim().length === 0;
    });

    genderBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        genderBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    btnBegin.addEventListener('click', () => {
      const name   = nameInput.value.trim();
      const gender = document.querySelector('.gender-btn.selected').dataset.gender;
      if (!name) return;
      Storage.saveHero(name, gender);
      this.state.heroName   = name;
      this.state.heroGender = gender;
      this.showMap();
    });

    document.getElementById('btn-open-diary').addEventListener('click',
      () => this.showDiaryFull());

    document.getElementById('btn-reset-all').addEventListener('click', () => {
      if (confirm('Начать заново? Весь прогресс будет удалён.')) {
        Storage.resetAll();
        this.state.heroName   = '';
        this.state.heroGender = 'm';
        this.showScreen('screen-start');
      }
    });

    document.getElementById('btn-to-map').addEventListener('click',
      () => this.showMap());

    document.getElementById('btn-restart').addEventListener('click', () => {
      if (this.state.currentChapterId) {
        Storage.resetChapter(this.state.currentChapterId);
        this.startChapter(this.state.currentChapterId);
      }
    });

    document.getElementById('btn-diary-next').addEventListener('click', () => {
      if (this.state.pendingReveal) {
        const el = document.getElementById('principles-text');
        el.innerHTML = this.state.pendingReveal;
        this.state.pendingReveal = null;
        this.showScreen('screen-principles');
      } else {
        this.showMap();
      }
    });

    document.getElementById('btn-principles-done').addEventListener('click',
      () => this.showMap());

    document.getElementById('btn-close-diary').addEventListener('click',
      () => this.showMap());
  },

  // ── SCREENS ───────────────────────────

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  },

  showMap() {
    this.renderMap();
    document.getElementById('map-hero-name').textContent = this.state.heroName;
    this.showScreen('screen-map');
  },

  // ── MAP ───────────────────────────────

  renderMap() {
    const list = document.getElementById('chapters-list');
    list.innerHTML = '';

    CONTENT.chapters.forEach((ch, idx) => {
      const completed = Storage.isCompleted(ch.id);
      const prevDone  = idx === 0 || Storage.isCompleted(CONTENT.chapters[idx - 1].id);
      const available = !completed && prevDone;

      const card = document.createElement('div');
      card.className = 'ch-card ' + (completed ? 'completed' : available ? 'available' : 'locked');

      const statusText = completed ? 'Пройдено ✓' : available ? 'Начать →' : 'Заблокировано';

      card.innerHTML =
        '<div><div class="ch-num">Глава ' + ch.number + '</div></div>' +
        '<div><div class="ch-title">' + ch.title + '</div></div>' +
        '<div class="ch-theme">' + ch.theme + '</div>' +
        '<div class="ch-status">' + statusText + '</div>';

      if (completed || available) {
        card.addEventListener('click', () => this.startChapter(ch.id));
      }

      list.appendChild(card);
    });
  },

  // ── CHAPTER ───────────────────────────

  startChapter(chapterId) {
    const chapter = CONTENT.chapters.find(c => c.id === chapterId);
    if (!chapter) return;

    this.state.currentChapterId = chapterId;
    this.state.currentChapter   = chapter;
    this.state.choicesCompleted = 0;
    this.state.correctionQueue  = [];

    document.getElementById('game-chapter-label').textContent =
      'Глава ' + chapter.number + ' · ' + chapter.title;

    this.updateProgress(0);
    this.showScreen('screen-game');
    this.showScene(chapter.first_scene);
  },

  // ── SCENE ─────────────────────────────

  showScene(sceneId) {
    this.state.currentSceneId = sceneId;
    const scene = this.state.currentChapter.scenes[sceneId];
    if (!scene) return;

    if (scene.type === 'chapter_end') {
      this.completeChapter();
      return;
    }

    this.renderCharacter(scene.character);
    this.renderText(scene.text || '', scene.character);

    const actions = document.getElementById('actions-area');
    actions.innerHTML = '';

    if (scene.type === 'dialogue') {
      this.renderContinueButton(() => this.showScene(scene.next));
    } else if (scene.type === 'choice') {
      this.renderChoices(scene);
    } else if (scene.type === 'multi_choice') {
      this.renderMultiChoice(scene);
    }
  },

  // ── RENDERING ─────────────────────────

  renderCharacter(charKey) {
    const char   = CONTENT.characters[charKey];
    const area   = document.getElementById('portrait-area');
    const img    = document.getElementById('portrait-img');
    const nameEl = document.getElementById('portrait-name');

    if (!char || char.style === 'narrator') {
      area.classList.add('hidden');
      return;
    }

    area.classList.remove('hidden');
    img.style.borderColor = char.color;
    nameEl.style.color    = char.color;

    if (char.style === 'hero') {
      const avatarFile = this.state.heroGender === 'f'
        ? 'avatars/avatar_hero_f.png'
        : 'avatars/avatar_hero_m.png';
      img.style.backgroundImage = `url('${avatarFile}')`;
      img.classList.add('has-avatar');
      img.textContent = '';
      img.style.color = 'transparent';
      nameEl.textContent = this.state.heroName || '';
    } else if (char.avatar) {
      img.style.backgroundImage = `url('${char.avatar}')`;
      img.classList.add('has-avatar');
      img.textContent    = '';
      img.style.color    = 'transparent';
      nameEl.textContent = char.name;
    } else {
      img.style.backgroundImage = '';
      img.classList.remove('has-avatar');
      img.textContent    = char.initials || '';
      img.style.color    = char.color;
      nameEl.textContent = char.name;
    }
  },

  renderText(text, charKey) {
    const char = CONTENT.characters[charKey];
    const el   = document.getElementById('dialogue-text');
    el.className = 'dialogue-text';

    if (char) {
      if (char.style === 'narrator') el.classList.add('narrator-style');
      if (char.style === 'voice')    el.classList.add('voice-style');
    }

    el.textContent = this.processText(text);
  },

  renderContinueButton(callback, label) {
    const actions = document.getElementById('actions-area');
    const btn     = document.createElement('button');
    btn.className   = 'btn-continue';
    btn.textContent = label || 'Продолжить →';
    btn.addEventListener('click', callback);
    actions.appendChild(btn);
  },

  renderChoices(scene) {
    const actions = document.getElementById('actions-area');
    actions.innerHTML = '';

    scene.choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className   = 'btn-choice';
      btn.textContent = this.processText(choice.text);
      btn.addEventListener('click', () => this.handleChoice(choice, btn));
      actions.appendChild(btn);
    });
  },

  // ── MULTI-CHOICE ──────────────────────

  renderMultiChoice(scene) {
    const actions = document.getElementById('actions-area');
    actions.innerHTML = '';

    const instr = document.createElement('p');
    instr.className   = 'multi-instruction';
    instr.textContent = scene.instruction || 'Выберите всё подходящее';
    actions.appendChild(instr);

    const selectedSet = new Set();
    const optEls = scene.options.map((opt, i) => {
      const btn = document.createElement('button');
      btn.className   = 'btn-choice';
      btn.textContent = this.processText(opt.text);
      btn.addEventListener('click', () => {
        if (selectedSet.has(i)) {
          selectedSet.delete(i);
          btn.classList.remove('multi-selected');
        } else {
          selectedSet.add(i);
          btn.classList.add('multi-selected');
        }
      });
      actions.appendChild(btn);
      return btn;
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.className   = 'btn-continue';
    confirmBtn.style.marginTop = '4px';
    confirmBtn.textContent = 'Подтвердить →';
    confirmBtn.addEventListener('click', () => {
      this.handleMultiChoice(scene, selectedSet, optEls, confirmBtn);
    });
    actions.appendChild(confirmBtn);
  },

  handleMultiChoice(scene, selectedSet, optEls, confirmBtn) {
    const hasWrong     = scene.options.some((opt, i) => !opt.correct && selectedSet.has(i));
    const correctHits  = scene.options.filter((opt, i) => opt.correct && selectedSet.has(i)).length;
    const totalCorrect = scene.options.filter(opt => opt.correct).length;

    if (!hasWrong && correctHits >= totalCorrect) {
      optEls.forEach((btn, i) => {
        btn.disabled = true;
        btn.classList.remove('multi-selected');
        if (scene.options[i].correct) btn.classList.add('correct');
      });
      confirmBtn.disabled = true;
      this.state.choicesCompleted++;
      this.updateProgress(this.state.choicesCompleted / this.state.currentChapter.total_choices);
      setTimeout(() => this.showScene(scene.next), 600);
    } else {
      optEls.forEach((btn, i) => {
        btn.disabled = true;
        btn.classList.remove('multi-selected');
        if (scene.options[i].correct)    btn.classList.add('correct');
        else if (selectedSet.has(i))     btn.classList.add('wrong');
      });
      confirmBtn.disabled = true;
      this.showCorrection(scene.correction || []);
    }
  },

  // ── CHOICE HANDLING ───────────────────

  handleChoice(choice, btn) {
    document.querySelectorAll('.btn-choice').forEach(b => { b.disabled = true; });

    if (choice.correct) {
      btn.classList.add('correct');
      this.state.choicesCompleted++;
      this.updateProgress(this.state.choicesCompleted / this.state.currentChapter.total_choices);
      setTimeout(() => this.showScene(choice.next), 600);
    } else {
      btn.classList.add('wrong');
      this.showCorrection(choice.correction || []);
    }
  },

  // ── CORRECTION FLOW ───────────────────

  showCorrection(items) {
    this.state.correctionQueue = [...items];
    this.showNextCorrectionItem();
  },

  showNextCorrectionItem() {
    const actions = document.getElementById('actions-area');
    actions.innerHTML = '';

    if (this.state.correctionQueue.length === 0) {
      const label   = this.state.heroGender === 'f' ? 'Поняла, попробую иначе' : 'Понял, попробую иначе';
      const btn     = document.createElement('button');
      btn.className   = 'btn-continue return-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => this.showScene(this.state.currentSceneId));
      actions.appendChild(btn);
      return;
    }

    const item = this.state.correctionQueue.shift();
    this.renderCharacter(item.character);
    this.renderText(item.text, item.character);

    const btn = document.createElement('button');
    btn.className   = 'btn-continue';
    btn.textContent = 'Продолжить →';
    btn.addEventListener('click', () => this.showNextCorrectionItem());
    actions.appendChild(btn);
  },

  // ── CHAPTER END ───────────────────────

  completeChapter() {
    const ch = this.state.currentChapter;
    Storage.completeChapter(ch.id, ch.diary_entry);
    this.state.pendingReveal = ch.diary_reveal || null;

    document.getElementById('ch-diary-tag').textContent =
      'Глава ' + ch.number + ' · ' + ch.theme;
    document.getElementById('ch-diary-title').textContent = 'Запись в дневнике';
    document.getElementById('ch-diary-text').textContent  = ch.diary_entry;

    this.showScreen('screen-chapter-diary');
  },

  // ── FULL DIARY ────────────────────────

  showDiaryFull() {
    const entries  = Storage.getDiary();
    const list     = document.getElementById('diary-list');
    const empty    = document.getElementById('diary-empty');
    list.innerHTML = '';

    if (entries.length === 0) {
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      entries.forEach(entry => {
        const ch  = CONTENT.chapters.find(c => c.id === entry.chapter_id);
        const tag = ch ? 'Глава ' + ch.number + ' · ' + ch.theme : entry.chapter_id;
        const div = document.createElement('div');
        div.className = 'diary-entry';
        const tagEl  = document.createElement('div');
        tagEl.className   = 'diary-entry-ch';
        tagEl.textContent = tag;
        const textEl = document.createElement('p');
        textEl.className   = 'diary-entry-text';
        textEl.textContent = entry.entry;
        div.appendChild(tagEl);
        div.appendChild(textEl);
        list.appendChild(div);
      });
    }

    this.showScreen('screen-diary');
  },

  // ── PROGRESS ──────────────────────────

  updateProgress(ratio) {
    document.getElementById('progress-fill').style.width =
      Math.min(1, Math.max(0, ratio)) * 100 + '%';
  },

  // ── TEXT PROCESSING ───────────────────

  processText(text) {
    if (!text) return '';
    const gender = this.state.heroGender;
    return text
      .replace(/\{hero_name\}/g, this.state.heroName)
      .replace(/\{\{([^|{}]+)\|([^|{}]+)\}\}/g, (_, male, female) =>
        gender === 'f' ? female : male
      );
  },

};

document.addEventListener('DOMContentLoaded', () => Engine.init());
