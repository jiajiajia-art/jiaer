// Single-HTML UI loader: mounts one user-provided HTML into Shadow DOM
import { CustomUIHost } from './host.js';

const uiRoot = document.getElementById('custom-ui-root');
const host = new CustomUIHost(uiRoot);
window.__customUIHost = host;
window.gameAPI = host.gameAPI; // expose to user HTML scripts

// demo state/actions (pure client, you can replace with real controller bridge)
const state = {
  scene: { id: 'scene-1', name: '山谷黄昏' },
  backgroundImage: document.getElementById('bg')?.style.backgroundImage || '',
  message: { id:1, type:'narration', text:'你来到一处幽静的山谷，晚霞映照着远处的云海。' },
  isTyping: false,
  isAutoPlay: false,
  isTextMode: false,
  isWaiting: false,
  historyLength: 1,
  points: 100,
  music: { isPlaying: false },
};

host.bindActions({
  setAutoPlay: (on)=> { state.isAutoPlay = (on==null ? !state.isAutoPlay : !!on); host.updateState({ isAutoPlay: state.isAutoPlay }); host.emit('autoPlayChange', { isAutoPlay: state.isAutoPlay }); },
  setTextMode: (on)=> { state.isTextMode = (on==null ? !state.isTextMode : !!on); host.updateState({ isTextMode: state.isTextMode }); host.emit('textModeChange', { isTextMode: state.isTextMode }); },
  toggleMusic: ()=> { state.music.isPlaying = !state.music.isPlaying; host.updateState({ music: { isPlaying: state.music.isPlaying } }); host.emit('musicChange', { isPlaying: state.music.isPlaying }); },
});

host.updateState(state);
host.emit('ready', host.getState());
host.emit('sceneChange', { scene: state.scene, backgroundImage: state.backgroundImage });
host.emit('messageChange', { message: state.message });

// helper to (re)execute scripts when injecting HTML into Shadow DOM
async function execScripts(shadow, ownerUrl, scripts){
  // Provide a stable global reference for user scripts (module or classic)
  try { window.__CUSTOM_UI_SHADOW__ = shadow; } catch (e) {}
  // Inject a selector patch so 3rd-party HTML that uses document.* can find nodes inside ShadowRoot
  try {
    const patch = document.createElement('script');
    patch.textContent = `(() => {
      try {
        const sr = window.__CUSTOM_UI_SHADOW__;
        if (!sr) return;
        const Doc = Document.prototype;
        const _qs = Doc.querySelector; const _qsa = Doc.querySelectorAll; const _ge = Doc.getElementById;
        Doc.querySelector = function(sel){ try{ const el = sr.querySelector(sel); if (el) return el; }catch(e){} return _qs.call(document, sel); };
        Doc.querySelectorAll = function(sel){ try{ const list = sr.querySelectorAll(sel); if (list && list.length) return list; }catch(e){} return _qsa.call(document, sel); };
        Doc.getElementById = function(id){ try{ const el = sr.querySelector('[id="'+id+'"]'); if (el) return el; }catch(e){} return _ge.call(document, id); };
        // If DOMContentLoaded listeners are registered after document is ready, run them immediately
        const _add = Doc.addEventListener;
        Doc.addEventListener = function(type, listener, options){
          if (type === 'DOMContentLoaded' && typeof listener === 'function') {
            try { if (document.readyState !== 'loading') { try { listener(new Event('DOMContentLoaded')); } catch(e){} } } catch(e){}
          }
          return _add.call(this, type, listener, options);
        };
      } catch (e) { console.warn('[CustomUI] selector patch failed', e); }
    })();`;
    shadow.appendChild(patch);
  } catch(e) { console.warn('[CustomUI] inject selector patch error', e); }
  for(const oldScript of scripts){
    const s = document.createElement('script');
    for(const a of oldScript.attributes){ s.setAttribute(a.name, a.value); }
    // ensure order
    s.async = false;
    if(oldScript.src){
      try { s.src = new URL(oldScript.getAttribute('src'), ownerUrl).href; } catch { s.src = oldScript.src; }
      await new Promise((resolve, reject) => {
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load '+s.src));
        shadow.appendChild(s);
      });
    } else {
      s.textContent = oldScript.textContent || '';
      shadow.appendChild(s);
    }
  }
}

function getUiListFromQuery(){
  try{
    const params = new URLSearchParams(window.location.search);
    const list = params.getAll('ui');
    if(list && list.length>0) return list;
  }catch(e){}
  // Default demo: two UIs (social + date HUD)
  return ['../custom_ui/user_ui.html', '../custom_ui/date_hud.html'];
}

async function loadMultipleUIs(){
  const uiList = getUiListFromQuery();
  let resetInjected = false;
  for(const rel of uiList){
    const htmlUrl = new URL(rel, import.meta.url);
    const res = await fetch(htmlUrl.href);
    if(!res.ok) { console.warn('[SimpleLoader] skip (load failed):', htmlUrl.href); continue; }
    const html = await res.text();

    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const frag = tpl.content;

    const scripts = Array.from(frag.querySelectorAll('script'));
    scripts.forEach(n=> n.parentNode && n.parentNode.removeChild(n));

    if(!resetInjected){
      const reset = document.createElement('style');
      reset.textContent = `:host{all:initial; display:contents;} *{box-sizing:border-box;} html,body{margin:0;padding:0}`;
      host.layerManager.shadowRoot.appendChild(reset);
      resetInjected = true;
    }

    host.layerManager.root.appendChild(frag);
    await execScripts(host.layerManager.shadowRoot, htmlUrl.href, scripts);
  }
}

loadMultipleUIs().catch((e)=>{
  console.error('[SimpleLoader] load error:', e);
});
