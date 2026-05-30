'use strict';

const Storage = {
  KEY: 'entrepreneur_trainer_v1',

  _load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  _save(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Storage: не удалось сохранить прогресс', e);
    }
  },

  _default() {
    return { hero_name: '', hero_gender: 'm', chapters: {}, diary: [] };
  },

  getState() {
    return this._load() || this._default();
  },

  saveHero(name, gender) {
    const s = this.getState();
    s.hero_name = name;
    s.hero_gender = gender;
    this._save(s);
  },

  completeChapter(chapterId, diaryEntry) {
    const s = this.getState();
    s.chapters[chapterId] = {
      completed: true,
      completed_at: new Date().toISOString()
    };
    if (!s.diary.some(d => d.chapter_id === chapterId)) {
      s.diary.push({
        chapter_id: chapterId,
        entry: diaryEntry,
        date: new Date().toISOString()
      });
    }
    this._save(s);
  },

  isCompleted(chapterId) {
    const s = this.getState();
    return !!(s.chapters[chapterId] && s.chapters[chapterId].completed);
  },

  resetChapter(chapterId) {
    const s = this.getState();
    delete s.chapters[chapterId];
    s.diary = s.diary.filter(d => d.chapter_id !== chapterId);
    this._save(s);
  },

  resetAll() {
    localStorage.removeItem(this.KEY);
  },

  getDiary() {
    return this.getState().diary || [];
  }
};
