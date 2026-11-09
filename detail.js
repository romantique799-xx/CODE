(() => {
  'use strict';

  const styles = [
    { title: 'Material Form', color: '#2A3313', encoding: 'outline' },
    { title: 'Instruction', color: '#4E5893', encoding: 'slashes' },
    { title: 'Translation', color: '#E0B894', encoding: 'morse' },
    { title: 'Shared Convention', color: '#C66674', encoding: 'double-happiness' },
    { title: 'a Tool for Building Complexity', color: '#515151', encoding: 'dots' }
  ];
  const morse = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
    G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
    M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
    S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
    Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---',
    3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...',
    8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--',
    '?': '..--..', '!': '-.-.--', "'": '.----.', '"': '.-..-.',
    '(': '-.--.', ')': '-.--.-', '-': '-....-', ':': '---...',
    '/': '-..-.', '&': '.-...', '=': '-...-', '+': '.-.-.', ';': '-.-.-.'
  };
  const svgNamespace = 'http://www.w3.org/2000/svg';
  let current = null;
  let measure;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svg(tag, attrs = {}, text) {
    const node = document.createElementNS(svgNamespace, tag);
    Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function wrap(paragraph, width) {
    const lines = [];
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? line + ' ' + word : word;
      if (line && measure.measureText(next).width > width) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function encodeMorse(text) {
    return text.toUpperCase()
      .replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
      .split(/\s+/)
      .map(word => Array.from(word, character => morse[character] || '').filter(Boolean).join('\u2009'))
      .join('   ').replace(/\./g, '·');
  }

  function encodeSlashes(width, row) {
    let code = '';
    let seed = (row + 1) * 15485863;
    const slashWidth = measure.measureText('/').width;
    const spaceWidth = measure.measureText(' ').width;
    for (let used = 0; used + slashWidth <= width;) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const spacing = (seed >>> 25) % 5;
      const spaces = spacing === 0 ? 0 : spacing < 4 ? 1 : 2;
      code += (seed >>> 31 ? '/' : '\\') + ' '.repeat(spaces);
      used += slashWidth + spaceWidth * spaces;
    }
    return code.trimEnd();
  }

  function encodedLine(line, width, row, baseline, x, page, top, lineHeight) {
    let text = line;
    const attrs = { x, y: baseline, 'xml:space': 'preserve' };
    const { encoding } = page;
    if (encoding === 'slashes') text = encodeSlashes(width, row);
    if (encoding === 'morse') {
      text = encodeMorse(line);
      if (measure.measureText(text).width > width) {
        attrs.textLength = width;
        attrs.lengthAdjust = 'spacingAndGlyphs';
      }
    }
    if (encoding === 'double-happiness') {
      text = '囍'.repeat(Math.max(1, Math.floor(width / page.fontSize)));
    }
    if (encoding === 'dots') {
      const size = page.fontSize * .44;
      const pitch = page.fontSize * .84;
      const squares = svg('g');
      const y = top + (lineHeight - size) / 2;
      for (let offset = 0; offset + size <= width; offset += pitch) {
        squares.append(svg('rect', { x: x + offset, y, width: size, height: size }));
      }
      return squares;
    }
    return svg('text', attrs, text);
  }

  function makeInk(page, region) {
    const path = svg('path', {
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': Math.max(1.25, page.fontSize * .065),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    });
    page.ink[region].append(path);
    return path;
  }

  function drawPath(page, stroke, pathNode) {
    const { region, points } = stroke;
    const coordinate = point =>
      (point.x * page.width).toFixed(1) + ' ' + (point.y * page.heights[region]).toFixed(1);
    let path = 'M ' + coordinate(points[0]);
    if (points.length === 1) {
      path += ' l 0.01 0';
    } else {
      for (let i = 1; i < points.length - 1; i++) {
        const point = points[i];
        const next = points[i + 1];
        const middle = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
        path += ' Q ' + coordinate(point) + ' ' + coordinate(middle);
      }
      path += ' L ' + coordinate(points[points.length - 1]);
    }
    pathNode.setAttribute('d', path);
  }

  function crosses(rect, x1, y1, x2, y2) {
    if (Math.max(y1, y2) < rect.top || Math.min(y1, y2) > rect.bottom) return false;
    let startX = x1;
    let endX = x2;
    if (y1 !== y2) {
      const atTop = (rect.top - y1) / (y2 - y1);
      const atBottom = (rect.bottom - y1) / (y2 - y1);
      startX = x1 + (x2 - x1) * Math.max(0, Math.min(atTop, atBottom));
      endX = x1 + (x2 - x1) * Math.min(1, Math.max(atTop, atBottom));
    }
    return Math.max(startX, endX) >= rect.left && Math.min(startX, endX) <= rect.right;
  }

  function revealSegment(page, region, from, to) {
    const height = page.heights[region];
    const x1 = from.x * page.width;
    const y1 = from.y * height;
    const x2 = to.x * page.width;
    const y2 = to.y * height;
    if (region === 'title') {
      if (!page.titleRevealed && crosses(page.titleBounds, x1, y1, x2, y2)) {
        page.titleRevealed = true;
        page.title.setAttribute('data-revealed', '');
      }
      return;
    }
    for (const row of page.rows) {
      if (row.revealed || !crosses(row, x1, y1, x2, y2)) continue;
      row.revealed = true;
      row.node.setAttribute('data-revealed', '');
      row.encoded.setAttribute('data-revealed', '');
    }
  }

  function applyPlainView(page) {
    page.reader.setAttribute('data-read-all', String(page.readAll));
    page.readButton.textContent = page.readAll ? 'Show encoded text' : 'Read plain text';
    page.readButton.setAttribute('aria-pressed', String(page.readAll));
  }

  function renderTitle(page) {
    const width = page.titleTypeset.getBoundingClientRect().width;
    const height = page.titleTypeset.getBoundingClientRect().height;
    const lineHeight = page.fontSize * 1.15;
    measure.font = '700 ' + page.fontSize + 'px Arial';
    const lines = wrap(page.titleText, width + 1);
    const metrics = measure.measureText('Ag');
    const ascent = metrics.fontBoundingBoxAscent ?? page.fontSize * .9;
    const descent = metrics.fontBoundingBoxDescent ?? page.fontSize * .2;
    const baseline = (lineHeight - ascent - descent) / 2 + ascent;
    const widths = lines.map(line => Math.min(width, measure.measureText(line).width));
    measure.font = page.fontSize + 'px Arial';
    page.titleCode.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    page.titleCode.replaceChildren();
    lines.forEach((line, row) => {
      const top = row * lineHeight;
      const encoded = encodedLine(line, widths[row], row, top + baseline, 0, page, top, lineHeight);
      encoded.setAttribute('class', 'code-detail-encoded code-detail-' + page.encoding);
      page.titleCode.append(encoded);
    });
    page.titleBounds = {
      left: page.title.offsetLeft,
      right: page.title.offsetLeft + page.title.offsetWidth,
      top: page.title.offsetTop,
      bottom: page.title.offsetTop + page.title.offsetHeight
    };
  }

  function fitWholeRows(page) {
    const available = page.reader.getBoundingClientRect().height -
      page.heading.getBoundingClientRect().height;
    const lineHeight = page.fontSize * 1.2;
    const fullRows = Math.floor(available / lineHeight);
    page.scroller.style.maxHeight = fullRows > 0 ? fullRows * lineHeight + 'px' : '';
  }

  function render(page) {
    const width = page.surface.clientWidth;
    if (!width) return;
    page.width = width;
    page.fontSize = parseFloat(getComputedStyle(page.surface).fontSize);
    measure ||= document.createElement('canvas').getContext('2d');
    renderTitle(page);
    const inset = parseFloat(getComputedStyle(page.surface).paddingLeft);
    const rightInset = parseFloat(getComputedStyle(page.surface).paddingRight);
    const usableWidth = Math.max(30, width - inset - rightInset);
    const lineHeight = page.fontSize * 1.2;
    const metrics = measure.measureText('Ag');
    const ascent = metrics.fontBoundingBoxAscent ?? page.fontSize * .9;
    const descent = metrics.fontBoundingBoxDescent ?? page.fontSize * .2;
    const baseline = (lineHeight - ascent - descent) / 2 + ascent;
    page.rows = [];
    const art = svg('svg', { class: 'code-detail-art', width, 'aria-hidden': 'true' });
    const encodedRows = svg('g');
    const plainRows = svg('g');
    art.append(encodedRows, plainRows);
    const fillsColumn = ['slashes', 'dots', 'double-happiness'].includes(page.encoding);
    let nextRowTop = 0;
    for (const [paragraphIndex, paragraph] of page.paragraphs.entries()) {
      if (paragraphIndex > 0) nextRowTop += lineHeight;
      const wrapped = wrap(paragraph, usableWidth);
      for (const [index, line] of wrapped.entries()) {
        const lineWidth = measure.measureText(line).width;
        const encodedWidth = fillsColumn && index < wrapped.length - 1 ? usableWidth : lineWidth;
        const top = nextRowTop;
        nextRowTop += lineHeight;
        const y = top + baseline;
        const node = svg('g', { class: 'code-detail-row' });
        const plain = svg('text', { x: inset, y, class: 'code-detail-plain' }, line);
        const encoded = encodedLine(line, encodedWidth, page.rows.length, y, inset, page, top, lineHeight);
        encoded.setAttribute('class', 'code-detail-encoded code-detail-' + page.encoding);
        if (page.encoding === 'outline') {
          // Clear neighboring heavy outlines where a row has been decoded.
          node.append(svg('rect', { class: 'code-detail-row-paper', y: top, width, height: lineHeight }));
        }
        node.append(plain);
        encodedRows.append(encoded);
        plainRows.append(node);
        page.rows.push({ node, encoded, top, bottom: top + lineHeight, left: inset, right: inset + Math.max(lineWidth, encodedWidth) });
      }
    }
    const artHeight = Math.ceil(nextRowTop);
    art.setAttribute('height', artHeight);
    art.setAttribute('viewBox', '0 0 ' + width + ' ' + artHeight);
    page.surface.replaceChildren(art);
    fitWholeRows(page);
    page.heights = { title: page.heading.clientHeight, body: page.content.offsetHeight };
    for (const region of ['title', 'body']) {
      page.ink[region].setAttribute('viewBox', '0 0 ' + width + ' ' + page.heights[region]);
      page.ink[region].replaceChildren();
    }
    page.active = null;
    for (const stroke of page.strokes) {
      const { region, points } = stroke;
      drawPath(page, stroke, makeInk(page, region));
      revealSegment(page, region, points[0], points[0]);
      for (let i = 1; i < points.length; i++) revealSegment(page, region, points[i - 1], points[i]);
    }
    applyPlainView(page);
  }

  function appendPoint(page, point, region) {
    const height = page.heights[region];
    const documentY = region === 'title' ? point.y : point.y - page.heights.title + page.scroller.scrollTop;
    const normalized = { x: point.x / page.width, y: documentY / height };
    let stroke = page.active.stroke;
    if (!stroke || stroke.region !== region) {
      stroke = { region, points: [normalized], path: makeInk(page, region) };
      page.active.stroke = stroke;
      page.strokes.push(stroke);
      revealSegment(page, region, normalized, normalized);
    } else {
      const previous = stroke.points[stroke.points.length - 1];
      const dx = (previous.x - normalized.x) * page.width;
      const dy = (previous.y - normalized.y) * height;
      if (Math.hypot(dx, dy) < .1) return;
      stroke.points.push(normalized);
      revealSegment(page, region, previous, normalized);
    }
    drawPath(page, stroke, stroke.path);
  }

  function tracePoint(page, event, frame) {
    const point = { x: event.clientX - frame.left, y: event.clientY - frame.top };
    const { active } = page;
    if (point.x < 0 || point.x > frame.width || point.y < 0 || point.y > frame.height) {
      active.stroke = null;
      active.last = null;
      return;
    }
    const boundary = page.heights.title;
    const region = point.y < boundary ? 'title' : 'body';
    const previous = active.last;
    if (previous && (previous.y < boundary) !== (region === 'title')) {
      const progress = (boundary - previous.y) / (point.y - previous.y);
      const edge = { x: previous.x + (point.x - previous.x) * progress, y: boundary };
      appendPoint(page, edge, previous.y < boundary ? 'title' : 'body');
      appendPoint(page, edge, region);
    }
    appendPoint(page, point, region);
    active.last = point;
  }

  function attachDrawing(page) {
    const { reader, scroller } = page;
    reader.addEventListener('pointerdown', event => {
      if (event.button !== 0 || page.active || event.target.closest('button')) return;
      reader.setPointerCapture(event.pointerId);
      event.preventDefault();
      page.active = { id: event.pointerId, stroke: null, last: null };
      tracePoint(page, event, reader.getBoundingClientRect());
    });
    reader.addEventListener('pointermove', event => {
      if (page.active?.id !== event.pointerId) return;
      const frame = reader.getBoundingClientRect();
      const coalesced = event.getCoalescedEvents?.();
      for (const sample of coalesced?.length ? coalesced : [event]) tracePoint(page, sample, frame);
    });
    scroller.addEventListener('scroll', () => {
      if (!page.active) return;
      page.active.stroke = null;
      page.active.last = null;
    }, { passive: true });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      reader.addEventListener(name, event => {
        if (page.active?.id === event.pointerId) page.active = null;
      });
    }
  }

  function close() {
    if (!current) return;
    current.resize?.disconnect();
    current.releaseWheel();
    current.root.hidden = true;
    current.root.replaceChildren();
    current = null;
  }

  function open(item, index, onBack) {
    close();
    const root = document.getElementById('entry');
    const style = styles[index];
    const entry = window.CODE_ENTRIES?.find(chapter => Number(chapter.id) === index + 1);
    const titleText = entry?.title || (index + 1) + '. Code as ' + style.title;
    const picture = element('div', 'code-detail-image');
    const photo = element('img');
    photo.src = 'assets/' + item.asset;
    photo.alt = item.title || titleText;
    photo.draggable = false;
    picture.append(photo);

    const back = element('button', 'code-detail-back code-detail-pill', 'back');
    back.type = 'button';
    back.setAttribute('aria-label', 'Back to the image network');
    back.addEventListener('click', onBack);
    const reader = element('div', 'code-detail-reader');
    const heading = element('header', 'code-detail-heading');
    const title = element('h1', 'code-detail-title code-detail-pill');
    title.id = 'entry-title';
    title.setAttribute('aria-label', titleText);
    const titleTypeset = element('span', 'code-detail-title-typeset');
    const plainTitle = element('span', 'code-detail-title-plain', titleText);
    plainTitle.setAttribute('aria-hidden', 'true');
    const titleCode = svg('svg', { class: 'code-detail-title-code', 'aria-hidden': 'true' });
    titleTypeset.append(plainTitle, titleCode);
    title.append(titleTypeset);

    const readButton = element('button', 'code-detail-read', 'Read plain text');
    readButton.type = 'button';
    const instructions = element('p', 'sr-only', 'Drag across the title and text to decode them and leave a mark. Scroll to continue reading.');
    const transcript = element('div', 'sr-only');
    const paragraphs = entry?.paragraphs || [];
    paragraphs.forEach(paragraph => transcript.append(element('p', '', paragraph)));
    const surface = element('article', 'code-detail-surface');
    surface.setAttribute('aria-hidden', 'true');

    const ink = {
      title: svg('svg', { class: 'code-detail-ink', 'aria-hidden': 'true' }),
      body: svg('svg', { class: 'code-detail-ink', 'aria-hidden': 'true' })
    };
    heading.append(title, instructions, readButton, ink.title);
    const scroller = element('div', 'code-detail-scroll');
    scroller.tabIndex = 0;
    scroller.setAttribute('aria-label', 'Scrollable chapter text');
    const content = element('div', 'code-detail-page');
    content.append(transcript, surface, ink.body);
    scroller.append(content);
    reader.append(heading, scroller);
    root.classList.add('code-detail');
    root.dataset.chapter = String(index + 1);
    root.style.setProperty('--chapter-ink', style.color);
    root.replaceChildren(picture, back, reader);
    root.hidden = false;
    const page = {
      ...style, root, reader, heading, scroller, content, surface, ink, paragraphs,
      title, titleText, titleTypeset, titleCode, readButton, strokes: [], readAll: false
    };
    current = page;
    render(page);

    readButton.addEventListener('click', () => {
      page.readAll = !page.readAll;
      applyPlainView(page);
    });
    root.addEventListener('wheel', handleOutsideWheel, { passive: false });
    function handleOutsideWheel(event) {
      if (event.ctrlKey || event.deltaY === 0 || scroller.contains(event.target)) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? page.fontSize * 1.2 : event.deltaMode === 2 ? scroller.clientHeight : 1;
      scroller.scrollTop += event.deltaY * unit;
    }
    page.releaseWheel = () => root.removeEventListener('wheel', handleOutsideWheel);
    attachDrawing(page);
    page.resize = new ResizeObserver(() => {
      const fontSize = parseFloat(getComputedStyle(surface).fontSize);
      if (surface.clientWidth && (surface.clientWidth !== page.width || fontSize !== page.fontSize)) render(page);
      else fitWholeRows(page);
    });
    page.resize.observe(surface);
    page.resize.observe(reader);
    page.resize.observe(heading);
    root.tabIndex = -1;
    root.focus({ preventScroll: true });
  }

  window.CODE_DETAIL = { open, close };
})();
