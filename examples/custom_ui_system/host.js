// Simple EventEmitter for gameAPI
class Emitter {
  constructor(){ this.map = new Map(); }
  on(evt, cb){ if(!this.map.has(evt)) this.map.set(evt, new Set()); this.map.get(evt).add(cb); }
  off(evt, cb){ const s=this.map.get(evt); if(s) s.delete(cb); }
  emit(evt, payload){ const s=this.map.get(evt); if(s) for(const cb of Array.from(s)) try{ cb(payload); }catch(e){ console.error('[Emitter]', e);} }
}

// Layered UI Manager inside Shadow DOM
class LayerManager {
  constructor(shadowRoot){
    this.shadowRoot = shadowRoot;
    // root container for layers
    this.root = document.createElement('div');
    this.root.className = 'ui-layers-root';
    this.shadowRoot.appendChild(this.root);

    // style (layer base)
    const baseStyle = document.createElement('style');
    baseStyle.textContent = `
      /* confine all layers to the host container */
      /* Root anchors at top-right and only occupies its visible children */
      .ui-layers-root{ position:absolute; top:0; right:0; pointer-events:auto; }
      /* IMPORTANT: use absolute to confine to the game container (#custom-ui-root), not the viewport */
      .ui-hud, .ui-drawer, .ui-modal, .ui-sheet, .ui-full{ position:absolute; pointer-events:auto; }
      .ui-hud{ z-index:1600; min-width: 280px; }
      /* debug outline for visibility */
      .ui-hud{ outline: 1px dashed rgba(0,255,0,.25); }
      .ui-drawer{ z-index:1700; top:0; bottom:0; width:360px; background:rgba(20,20,20,.92); color:#fff; box-shadow:-8px 0 24px rgba(0,0,0,.4); transform: translateX(100%); transition: transform .24s cubic-bezier(0.4,0,0.2,1); }
      .ui-drawer.open{ transform: translateX(0); }
      .ui-drawer.right{ right:0; }
      .ui-drawer.left{ left:0; transform: translateX(-100%);} .ui-drawer.left.open{ transform: translateX(0);} 
      .ui-modal{ z-index:1800; inset:0; display:flex; align-items:center; justify-content:center; }
      .ui-modal .card{ min-width:280px; max-width:86vw; background:#111; color:#fff; border-radius:12px; padding:16px; box-shadow:0 8px 32px rgba(0,0,0,.5); transform:scale(.92); opacity:0; transition:.2s; }
      .ui-modal.open .card{ transform:scale(1); opacity:1; }
      .ui-sheet{ z-index:1700; left:0; right:0; bottom:0; background:rgba(20,20,20,.95); color:#fff; border-radius:12px 12px 0 0; box-shadow:0 -8px 24px rgba(0,0,0,.4); transform: translateY(100%); transition: transform .24s cubic-bezier(0.4,0,0.2,1); }
      .ui-sheet.open{ transform: translateY(0); }
      .ui-full{ z-index:1800; inset:0; background:rgba(0,0,0,.6); }
      .ui-backdrop{ position:absolute; inset:0; z-index:1650; background:rgba(0,0,0,.35); backdrop-filter: blur(6px); opacity:0; pointer-events:none; transition: opacity .2s; }
      .ui-backdrop.visible{ opacity:1; pointer-events:auto; }
      .ui-btn{ background:#6366f1; color:#fff; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; }
    `;
    this.shadowRoot.appendChild(baseStyle);

    // Backdrop disabled per request; keep node hidden to allow easy toggle in future
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'ui-backdrop';
    this.backdrop.style.display = 'none';
    this.shadowRoot.appendChild(this.backdrop);

    this.stacks = new Map(); // pluginId -> [{id,type,el,options,params}]
    this.emitter = new Emitter();

    // esc to close top-most
    this._escHandler = (e)=>{ if(e.key==='Escape'){ this.back(); }};
    window.addEventListener('keydown', this._escHandler);
  }

  destroy(){ window.removeEventListener('keydown', this._escHandler); }

  registerPages(pluginId, pages){
    if(!this.pages) this.pages = new Map();
    this.pages.set(pluginId, pages.reduce((m,p)=>{ m.set(p.id,p); return m; }, new Map()));
  }

  open(pluginId, pageId, params){
    const pageMap = this.pages?.get(pluginId);
    if(!pageMap || !pageMap.has(pageId)){
      console.warn('[LayerManager] page not found', pluginId, pageId);
      return null;
    }
    const page = pageMap.get(pageId);
    const stack = this._ensureStack(pluginId);

    // prevent duplicates: if page already exists in stack, move it to top and return
    const existingIdx = stack.findIndex(s=> s.id === page.id);
    if(existingIdx >= 0){
      const existing = stack.splice(existingIdx,1)[0];
      // update params and re-mount so UI can refresh
      existing.params = params;
      try{
        page.mount({ shadowRoot: existing.el, params, close: ()=>this.close(existing), getStack: ()=>stack });
      }catch(e){ console.error('[LayerManager remount]', e); }
      stack.push(existing);
      this._syncBackdrop();
      this.emitter.emit('pageChange', { pluginId, stack: stack.map(s=>({id:s.id, type:s.type})) });
      return existing;
    }

    const entry = { id: page.id, type: page.type, el: null, options: page.options||{}, params };

    // create element by type
    const el = this._createElementForPage(entry);
    entry.el = el;

    // mount content
    try{
      page.mount({ shadowRoot: el, params, close: ()=>this.close(entry), getStack: ()=>stack });
    }catch(e){ console.error('[LayerManager mount]', e); }

    stack.push(entry);
    this._syncBackdrop();
    this.emitter.emit('pageChange', { pluginId, stack: stack.map(s=>({id:s.id, type:s.type})) });
    return entry;
  }

  close(entryOrId){
    for(const [pluginId, stack] of this.stacks){
      const idx = typeof entryOrId==='string' ? stack.findIndex(s=>s.id===entryOrId) : stack.indexOf(entryOrId);
      if(idx>=0){
        const [entry] = stack.splice(idx,1);
        this._teardown(entry);
        this._syncBackdrop();
        this.emitter.emit('pageChange', { pluginId, stack: stack.map(s=>({id:s.id,type:s.type})) });
        return;
      }
    }
  }

  back(pluginId){
    if(pluginId){
      const stack = this.stacks.get(pluginId) || [];
      if(stack.length>0) this.close(stack[stack.length-1]);
      return;
    }
    // close the most top across all stacks
    let top=null, topKey=null;
    for(const [pid, stack] of this.stacks){ if(stack.length>0){ const e=stack[stack.length-1]; if(!top) { top=e; topKey=pid; } } }
    if(top) this.close(top);
  }

  closeAll(pluginId){
    if(pluginId){
      const stack = this.stacks.get(pluginId)||[];
      while(stack.length>0){ this._teardown(stack.pop()); }
      this._syncBackdrop();
      this.emitter.emit('pageChange', { pluginId, stack: [] });
      return;
    }
    for(const [pid, stack] of this.stacks){ while(stack.length>0){ this._teardown(stack.pop()); } this.emitter.emit('pageChange', { pluginId: pid, stack: [] }); }
    this._syncBackdrop();
  }

  on(evt, cb){ this.emitter.on(evt, cb); }

  getState(){
    const result={ stacks:{} };
    for(const [pid, stack] of this.stacks){ result.stacks[pid] = { stack: stack.map(s=>({id:s.id,type:s.type, params:s.params})) }; }
    // find any active top (first non-empty)
    for(const [pid, stack] of this.stacks){ if(stack.length>0){ result.activeTop={ pluginId: pid, pageId: stack[stack.length-1].id }; break; } }
    return result;
  }

  _ensureStack(pluginId){ if(!this.stacks.has(pluginId)) this.stacks.set(pluginId, []); return this.stacks.get(pluginId); }

  _createElementForPage(entry){
    const t = entry.type;
    if(t==='hud'){
      const wrap = document.createElement('div');
      wrap.className='ui-hud';
      // default position: top-right
      wrap.style.top='16px'; wrap.style.right='16px';
      this.root.appendChild(wrap);
      return wrap;
    }
    if(t==='drawer'){
      const wrap = document.createElement('div');
      wrap.className='ui-drawer right';
      const open = ()=> requestAnimationFrame(()=> wrap.classList.add('open'));
      this.root.appendChild(wrap); open();
      return wrap;
    }
    if(t==='sheet'){
      const wrap = document.createElement('div');
      wrap.className='ui-sheet';
      wrap.style.height = (entry.options?.height || '70vh');
      const open = ()=> requestAnimationFrame(()=> wrap.classList.add('open'));
      this.root.appendChild(wrap); open();
      return wrap;
    }
    if(t==='modal'){
      const wrap = document.createElement('div');
      wrap.className='ui-modal';
      const card = document.createElement('div'); card.className='card'; wrap.appendChild(card);
      const open = ()=> requestAnimationFrame(()=> wrap.classList.add('open'));
      this.root.appendChild(wrap); open();
      return card; // mount into card
    }
    if(t==='fullscreen'){
      const wrap = document.createElement('div'); wrap.className='ui-full'; this.root.appendChild(wrap); return wrap;
    }
    // fallback
    const wrap = document.createElement('div'); this.root.appendChild(wrap); return wrap;
  }

  _teardown(entry){ if(!entry?.el) return; const node = (entry.type==='modal') ? entry.el.parentElement : entry.el; if(node && node.parentNode){ node.parentNode.removeChild(node); } }

  _syncBackdrop(){ /* backdrop disabled */ }

  handleBackdropClick(){ /* no-op backdrop disabled */ }
}

// Host to manage ShadowRoot and expose gameAPI
export class CustomUIHost {
  constructor(hostContainer){
    this.container = hostContainer; // normal DOM node under main content overlay
    this.rootEl = document.createElement('div');
    this.container.appendChild(this.rootEl);
    // ensure shadow host element establishes a positioning context
    Object.assign(this.rootEl.style, { position:'absolute', inset:'0' });

    this.shadowRoot = this.rootEl.attachShadow({ mode: 'open' });
    this.layerManager = new LayerManager(this.shadowRoot);

    // base reset style to be predictable
    const reset = document.createElement('style');
    reset.textContent = `*,*::before,*::after{box-sizing:border-box;} html,body,:host{margin:0;padding:0;}`;
    this.shadowRoot.appendChild(reset);

    // CSS injection hook for plugin style file content
    this.styleEl = document.createElement('style');
    this.shadowRoot.appendChild(this.styleEl);

    this.emitter = new Emitter();
    this.state = { scene:null, backgroundImage:'', message:null, isTyping:false, isAutoPlay:false, isTextMode:false, isWaiting:false, historyLength:0, points:0, music:{isPlaying:false} };

    // build gameAPI facade
    this.gameAPI = {
      on: (evt, cb)=> this.emitter.on(evt, cb),
      getState: ()=> ({...this.state}),
      // actions (no-op defaults, can be overridden by test harness)
      next: ()=>{}, choose: ()=>{}, send: ()=>{}, setTextMode: ()=>{}, setAutoPlay: ()=>{}, toggleMusic: ()=>{}, openHistory: ()=>{}, closeHistory: ()=>{}, start: ()=>{}, exit: ()=>{},
      ui: {
        registerPages: (pluginId, pages)=> this.layerManager.registerPages(pluginId, pages),
        open: (pluginId, pageId, params)=> this.layerManager.open(pluginId, pageId, params),
        close: (handleOrId)=> this.layerManager.close(handleOrId),
        back: (pluginId)=> this.layerManager.back(pluginId),
        closeAll: (pluginId)=> this.layerManager.closeAll(pluginId),
        getState: ()=> this.layerManager.getState(),
        on: (evt, cb)=> this.layerManager.on(evt, cb),
      }
    };

    // Pointer proxy no longer needed when base root ignores pointer events.
    // If you need diagnostics, call this._setupPointerProxy() manually.
  }

  setPluginStyle(cssText){ this.styleEl.textContent = cssText || ''; }

  // wire actions to external handlers
  bindActions(actions){ Object.assign(this.gameAPI, actions || {}); }

  updateState(patch){ Object.assign(this.state, patch||{}); this.emitter.emit('stateChange', this.getState()); }
  emit(evt, payload){ this.emitter.emit(evt, payload); }
  getState(){ return {...this.state}; }

  _setupPointerProxy(){
    this._proxying = false;
    const debug = true; // temporary: always log for diagnostics; switch to localStorage flag later
    const getXY = (ev) => {
      if (ev && typeof ev.clientX === 'number' && typeof ev.clientY === 'number') return { x: ev.clientX, y: ev.clientY };
      const te = ev && ((ev.touches && ev.touches[0]) || (ev.changedTouches && ev.changedTouches[0]));
      if (te && typeof te.clientX === 'number' && typeof te.clientY === 'number') return { x: te.clientX, y: te.clientY };
      return null;
    };
    const makeTransparentForAWhile = (ms=140) => {
      const prev = this.container.style.pointerEvents;
      this.container.style.pointerEvents = 'none';
      setTimeout(() => { try { this.container.style.pointerEvents = prev || ''; } catch(e){} }, ms);
      if (debug) console.log('[CustomUI][transparent]', ms, 'ms');
    };
    const isInVisibleUserUI = (x, y) => {
      try {
        if (!this.shadowRoot || !this.layerManager?.root) return false;
        const nodes = this.shadowRoot.elementsFromPoint ? this.shadowRoot.elementsFromPoint(x, y) : [];
        if (debug) {
          const arr = nodes.map(n=> n && n.nodeType===1 ? `${n.tagName.toLowerCase()}${n.id?`#${n.id}`:''}${n.className?'.'+String(n.className).replace(/\s+/g,'.'):''}` : String(n));
          console.log('[CustomUI][hit-test] shadow elementsFromPoint', x, y, arr);
        }
        for (const n of nodes) {
          // skip non-elements and infrastructure nodes
          if (!n || n.nodeType !== 1) continue;
          if (n === this.layerManager.root) continue; // transparent base
          if (n === this.backdrop) continue;
          const el = n;
          const cs = window.getComputedStyle(el);
          const hidden = cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none';
          const zero = (el.offsetWidth === 0 && el.offsetHeight === 0);
          if (hidden || zero) continue;
          // Determine if element is likely interactive: semantic or focusable or pointer cursor or explicit onclick
          const clickableSelector = 'button, a[href], input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';
          const clickable = el.matches(clickableSelector) || el.getAttribute('onclick') != null || cs.cursor === 'pointer';
          if (clickable) return true;
          // If not directly clickable, continue to check other nodes in the stack
        }
      } catch (e) {}
      return false;
    };

    const forward = (ev) => {
      // Forward to underlying element at same point
      this._proxying = true;
      const coords = getXY(ev);
      const prev = this.container.style.pointerEvents;
      this.container.style.pointerEvents = 'none';
      const under = coords ? document.elementFromPoint(coords.x, coords.y) : null;
      if (debug && document.elementsFromPoint && coords) {
        const stack = document.elementsFromPoint(coords.x, coords.y).slice(0,10).map(n=> n && n.nodeType===1 ? `${n.tagName.toLowerCase()}${n.id?`#${n.id}`:''}${n.className?'.'+String(n.className).replace(/\s+/g,'.'):''}` : String(n));
        console.log('[CustomUI][doc elementsFromPoint]', stack);
      }
      if (debug) {
        console.log('[CustomUI][forward]', ev.type, 'to', under ? `${under.tagName.toLowerCase()}#${under.id||''}.${under.className||''}` : under);
      }
      this.container.style.pointerEvents = prev || '';
      if (under && under !== this.container) {
        const opts = {
          bubbles:true,
          cancelable:true,
          composed:true,
          clientX: coords ? coords.x : 0,
          clientY: coords ? coords.y : 0,
          screenX:ev.screenX,
          screenY:ev.screenY,
          ctrlKey:ev.ctrlKey,
          shiftKey:ev.shiftKey,
          altKey:ev.altKey,
          metaKey:ev.metaKey,
          button: ev.button != null ? ev.button : 0,
          buttons: ev.buttons != null ? ev.buttons : 1,
          detail: ev.detail != null ? ev.detail : 1
        };
        if (ev.type === 'click' && typeof under.click === 'function') {
          // Prefer native click() to trigger frameworks' delegated handlers reliably
          under.click();
        } else {
          let forwarded;
          if (window.PointerEvent && ev instanceof PointerEvent) forwarded = new PointerEvent(ev.type, opts);
          else if (window.MouseEvent && (ev.type === 'mousedown' || ev.type === 'mouseup')) forwarded = new MouseEvent(ev.type, opts);
          else forwarded = new Event(ev.type, { bubbles:true, cancelable:true, composed:true });
          under.dispatchEvent(forwarded);
        }
      }
      ev.preventDefault();
      ev.stopImmediatePropagation();
      this._proxying = false;
    };

    const handler = (ev) => {
      if (this._proxying) return;
      // If click lies outside any visible user UI element, forward to host
      const c = getXY(ev);
      const inUser = c ? isInVisibleUserUI(c.x, c.y) : false;
      if (debug) console.log('[CustomUI][event]', ev.type, { x: c?.x, y: c?.y, inUser });
      // For down/start events: briefly make overlay transparent so the upcoming click targets the host
      if (!inUser && (ev.type === 'pointerdown' || ev.type === 'mousedown' || ev.type === 'touchstart')) {
        makeTransparentForAWhile(140);
        ev.preventDefault();
        ev.stopImmediatePropagation();
        return;
      }
      // For click/end events: forward explicitly (native click preferred)
      if (!inUser && (ev.type === 'click' || ev.type === 'mouseup' || ev.type === 'touchend')) {
        return forward(ev);
      }
      // else: let user UI handle normally
    };
    // Capture phase to intercept before React handlers
    this.container.addEventListener('pointerdown', handler, true);
    this.container.addEventListener('click', handler, true);
    this.container.addEventListener('mousedown', handler, true);
    this.container.addEventListener('mouseup', handler, true);
    this.container.addEventListener('touchstart', handler, true);
    this.container.addEventListener('touchend', handler, true);
    this.container.addEventListener('touchcancel', handler, true);
    this._pointerProxyHandler = handler;
  }

  // helper to load file text
  static async loadText(url){ const res = await fetch(url); if(!res.ok) throw new Error('Load failed: '+url); return await res.text(); }
}
