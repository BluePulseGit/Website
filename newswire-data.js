/* ============================================================
   newswire-data.js — Newswire post store (demo CMS)
   Seed posts ship with the site; admin edits/new posts are kept
   in localStorage and merged on load. Shared by:
   journal.html, newswire-post.html, admin console.

   NOTE: This is a demonstration CMS. Posts created in the admin
   live in THIS BROWSER's localStorage only. For production,
   replace with a real CMS or Shopify blog.
   ============================================================ */
(function () {
  const KEY = 'bpsNewsPosts';

  /* Titles support *italics* via asterisks. Bodies are plain text;
     blank lines split paragraphs. */
  const SEED_POSTS = [
    {
      id: 'stay-home-wraps',
      date: '2026-04-18',
      tag: 'Stay Home',
      author: 'Production team',
      featured: true,
      placeholder: true,
      image: 'assets/stay-home-logo.webp',
      title: 'Stay Home wraps principal photography. *Now we cut.*',
      excerpt: 'Forty-three shooting days in the woods outside Pittsburgh, two reshoot weekends, one full-day standoff with a thunderstorm that we ended up using anyway. The rough cut is on a hard drive in someone’s backpack right now and we couldn’t be more relieved or more nervous. Here’s what we learned.',
      body: 'Forty-three shooting days. Two reshoot weekends. One thunderstorm that shut us down for a full day and then ended up in the movie, because sometimes the weather has better ideas than the shot list.\n\nThis is placeholder body copy for demonstration purposes. The real post will be written and published through the admin console when the site goes live.\n\nWhat happens next: picture lock, sound design in the spring, and a color pass we’ve been arguing about since pre-production. We’ll post the first cut notes here.'
    },
    {
      id: 'painting-cut-scene',
      date: '2026-04-02',
      tag: 'The Painting',
      author: 'Director’s note',
      featured: false,
      placeholder: true,
      image: 'assets/the-painting-poster.webp',
      title: 'The scene we cut from *The Painting*.',
      excerpt: 'There was a four-minute scene in The Painting where the painter walks the same hallway twice and the second time the door at the end is open. We loved it. We tested it. It killed the entire third act. Here’s why it didn’t make the final.',
      body: 'There was a four-minute scene where the painter walks the same hallway twice, and the second time, the door at the end is open. We loved it. Audiences loved it. It also killed the third act stone dead.\n\nThis is placeholder body copy for demonstration purposes. The real post will be written and published through the admin console when the site goes live.'
    },
    {
      id: 'no-streaming-deal',
      date: '2026-03-24',
      tag: 'Studio',
      author: 'Founders',
      featured: false,
      placeholder: true,
      image: '',
      title: 'Why we said no to the streaming deal.',
      excerpt: 'Last quarter we walked away from a multi-picture deal with a major streamer that would have changed our financial trajectory. We’ve been writing this note in our heads ever since. Some thoughts on patience, on ownership, and on the math of a boutique studio that intends to stay one.',
      body: 'Last quarter we walked away from a multi-picture deal with a major streamer. This is the note we’ve been writing in our heads ever since.\n\nThis is placeholder body copy for demonstration purposes. The real post will be written and published through the admin console when the site goes live.'
    },
    {
      id: 'drop-01-live',
      date: '2026-03-09',
      tag: 'Drop 01',
      author: 'Studio note',
      featured: false,
      placeholder: true,
      image: 'assets/ashen-man-hoodie-clean-V2.webp',
      title: 'Drop 01 is live: *The Ashen Man*.',
      excerpt: 'Five hundred numbered hoodies, two figurines, a board game, and a few quieter pieces. We made these the way we make the films — in small batches, with our own hands, with people whose names we know. They go up tonight.',
      body: 'Five hundred numbered hoodies. Two figurines. A board game. A few quieter pieces.\n\nThis is placeholder body copy for demonstration purposes. The real post will be written and published through the admin console when the site goes live.'
    },
    {
      id: 'red-winter-second-printing',
      date: '2026-02-21',
      tag: 'Red Winter',
      author: 'Kriegsspiel Press',
      featured: false,
      placeholder: true,
      image: 'assets/red-winter-rulebook.webp',
      title: 'Red Winter, second printing — what changed.',
      excerpt: 'First-edition errata, the rules clarification doc that grew into a small zine, and the four house rules we decided to make official. If you have a first-edition rulebook, you’re still good. Here’s the diff.',
      body: 'If you have a first-edition rulebook, you’re still good. Here’s the diff.\n\nThis is placeholder body copy for demonstration purposes. The real post will be written and published through the admin console when the site goes live.'
    },
    {
      id: 'patient-manifesto',
      date: '2026-02-03',
      tag: 'Studio',
      author: 'Founders',
      featured: false,
      placeholder: true,
      image: '',
      title: 'Why *patient* is in our manifesto.',
      excerpt: 'A short essay on what “patient” actually means in our process. Not slow, not lazy, not avoidant. Patient in the way a good interrogator is patient. We’ll wait for the scene to give itself up.',
      body: 'Not slow. Not lazy. Not avoidant. Patient in the way a good interrogator is patient.\n\nThis is placeholder body copy for demonstration purposes. The real post will be written and published through the admin console when the site goes live.'
    },
    {
      id: 'sitges-speech',
      date: '2026-01-14',
      tag: 'The Painting',
      author: 'Founders',
      featured: false,
      placeholder: true,
      image: 'assets/the-painting-poster.webp',
      title: 'Sitges. We won. Here’s the speech we didn’t give.',
      excerpt: 'The Painting took Best Short at Sitges and we were not in the room. Here’s the speech that lived in the editing software for three weeks beforehand, in case anyone wants to read what we would have said.',
      body: 'The Painting took Best Short at Sitges, and we were not in the room.\n\nThis is placeholder body copy for demonstration purposes. The real post will be written and published through the admin console when the site goes live.'
    }
  ];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) return arr;
      }
    } catch (_) {}
    return SEED_POSTS.map(p => Object.assign({}, p));
  }

  function save(posts) {
    try { localStorage.setItem(KEY, JSON.stringify(posts)); return true; }
    catch (e) { return false; } // usually: localStorage quota (images too large)
  }

  function sorted(posts) {
    return posts.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  /* Escape HTML, then allow *italics* only. */
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function fmtTitle(s) {
    return esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }
  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${m} &middot; ${d} &middot; ${y}`;
  }
  function fmtBody(s) {
    return esc(s).split(/\n\s*\n/).map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
  }

  window.bpsNews = {
    KEY,
    seeds: SEED_POSTS,
    /* true when the admin "hide placeholder content" toggle is on */
    hidePH() { try { return localStorage.getItem('bpsHidePlaceholders') === '1'; } catch (_) { return false; } },
    setHidePH(on) { try { on ? localStorage.setItem('bpsHidePlaceholders', '1') : localStorage.removeItem('bpsHidePlaceholders'); } catch (_) {} },
    /* posts visible to the public: no drafts, no future-dated (scheduled)
       posts, and no placeholder posts when the hide toggle is on */
    visible() {
      const today = new Date().toISOString().slice(0, 10);
      let p = sorted(load()).filter(x => !x.draft && (!x.date || x.date <= today));
      return this.hidePH() ? p.filter(x => !x.placeholder) : p;
    },
    all() { return sorted(load()); },
    get(id) { return load().find(p => p.id === id) || null; },
    upsert(post) {
      const posts = load();
      const i = posts.findIndex(p => p.id === post.id);
      if (i >= 0) posts[i] = post; else posts.push(post);
      return save(posts);
    },
    remove(id) { return save(load().filter(p => p.id !== id)); },
    reset() { try { localStorage.removeItem(KEY); } catch (_) {} },
    isCustomized() { try { return !!localStorage.getItem(KEY); } catch (_) { return false; } },
    fmt: { title: fmtTitle, date: fmtDate, body: fmtBody, esc }
  };
})();
