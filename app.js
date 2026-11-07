import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

// Publishable browser configuration. NEVER add a service_role/secret key to this file.
const SUPABASE_URL = 'https://imfgumnpbxhbrjlkiphf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kJL7tvsZ-pTX6hm5JRTcFw_W66hhoxv';
const api = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {auth:{autoRefreshToken:true,persistSession:true}});
// A saída explícita deve permanecer válida mesmo quando a rede ou o Auth falhar.
// O nome da chave corresponde ao storage padrão do Supabase para este projeto.
const AUTH_SESSION_STORAGE_KEY = 'sb-' + new URL(SUPABASE_URL).hostname.split('.')[0] + '-auth-token';
const EXPLICIT_LOGOUT_KEY = 'filtros-studio-explicit-logout-v1';
let logoutPending = false;
function setExplicitLogout(value){
  try {
    if(value)sessionStorage.setItem(EXPLICIT_LOGOUT_KEY,'1');
    else sessionStorage.removeItem(EXPLICIT_LOGOUT_KEY);
  } catch (_) { /* Safari privado: o logout local segue normalmente. */ }
}
function wasExplicitlyLoggedOut(){
  try { return sessionStorage.getItem(EXPLICIT_LOGOUT_KEY)==='1'; }
  catch (_) { return false; }
}
function clearStoredAuthSession(){
  try {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY+'-code-verifier');
  } catch (_) { /* A SDK também tentará limpar a sessão. */ }
}
const $ = id=>document.getElementById(id);
const escapeHtml = v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl = n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dateBR = d=>d?new Date(d+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const today=()=>new Date().toISOString().slice(0,10);
const id=()=>crypto.randomUUID();
function readAdminPrivacyPreference(){try{return localStorage.getItem('fs-admin-sensitive-hidden')==='1';}catch(_){return false;}}
const app={ adminSensitiveHidden:readAdminPrivacyPreference(),user:null,profile:null,company:null,companies:[],categories:[],filters:[],invoices:[],settings:{},page:'dashboard', modal:null, selectedCategory:null,selectedFilter:null,stream:null,images:new Map(),processing:false,captureData:null,galleryPhoto:null,cameraRequestId:0,adminTest:{active:false,companyId:null,categoryId:null},categoryOrderCompanyId:null,orderSaving:false };
let toastTimer;
const toast=(message)=>{const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),5000)};
const errorMessage=error=>error?.message||'Não foi possível concluir esta operação.';

const brandColor=(v,fallback)=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v)?v:fallback;
function brandInk(hex){const h=brandColor(hex,'#DB2032').slice(1);const c=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));return c[0]*.2126+c[1]*.7152+c[2]*.0722>.38?'#131D34':'#FFFFFF';}
// A identidade visual da plataforma é fixa; só a logo da empresa personaliza a área do cliente.
function brandStyle(_company){return '--brand-primary:#001893;--brand-accent:#eaf0ff;--brand-on-accent:#001893;--brand-on-primary:#ffffff;';}
const companyInitials=company=>String(company?.name||'FS').trim().split(/\s+/).slice(0,2).map(word=>word.charAt(0)).join('').toUpperCase()||'FS';
const brandImg=(company,cls)=>company?.logo_path?`<img data-brand-logo="${escapeHtml(company.id)}" class="${cls}" alt="" aria-hidden="true" decoding="async">`:'';

const option=(value,text,selected)=>`<option value="${escapeHtml(value)}" ${selected?'selected':''}>${escapeHtml(text)}</option>`;
const companyName=uid=>app.companies.find(c=>c.id===uid)?.name||'Empresa';
const categoryName=uid=>app.categories.find(c=>c.id===uid)?.name||'Categoria';
const badge=(status)=>{const cls=status==='paid'||status==='active'?'':status==='pending'?'warn':'danger';const txt={active:'Ativo',inactive:'Inativo',paused:'Pausado',paid:'Pago',pending:'Pendente',overdue:'Atrasado',canceled:'Cancelado'}[status]||status;return `<span class="chip ${cls}">${txt}</span>`};
const dueStatus=invoice=>invoice.status==='paid'?'paid':invoice.status==='canceled'?'canceled':invoice.due_date<today()?'overdue':'pending';
const button=(label,action)=>`<button class="btn btn-primary" data-act="${action}">＋ ${label}</button>`;
const action=(what,uid,label,css='')=>`<button class="small-action ${css}" data-act="${what}" data-id="${escapeHtml(uid)}">${label}</button>`;
const header=(tag,title,subtitle,right='')=>`<div class="heading"><div><small>${tag}</small><h1>${title}</h1><p>${subtitle}</p></div>${right}</div>`;
const sensitiveValue=value=>`<span class="admin-sensitive">${value}</span>`;
const stat=(label,value,sub)=>`<div class="stat"><label>${label}</label><b class="admin-sensitive">${value}</b><small>${String(sub).replace(/(\\d[\\d.,]*)/g,match=>sensitiveValue(match))}</small></div>`;
const field=(name,label,value='',type='text',required=true,minLength=0)=>`<div class="field"><label for="f_${name}">${label}</label><input id="f_${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${minLength?`minlength="${minLength}" maxlength="128"`:''} ${required?'required':''}></div>`;
const select=(name,label,opts)=>`<div class="field"><label for="f_${name}">${label}</label><select name="${name}" id="f_${name}" required>${opts}</select></div>`;
const companyOptions=(selected='')=>app.companies.map(c=>option(c.id,c.name,c.id===selected)).join('');
const endForm='<div class="form-actions"><button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn btn-primary" type="submit">Salvar</button></div>';
function stopCamera(){
  app.cameraRequestId++;
  if(app.stream){app.stream.getTracks().forEach(t=>t.stop());app.stream=null;}
}
function clearGalleryPhoto(){
  if(app.galleryPhoto?.url)URL.revokeObjectURL(app.galleryPhoto.url);
  app.galleryPhoto=null;
}
function clearCapturedPhoto(){if(app.captureData?.url)URL.revokeObjectURL(app.captureData.url);app.captureData=null;}
// Reentrada na câmera = nova sessão. Nunca reutilizar a foto anterior da galeria,
// o arquivo exportado, a câmera frontal anterior ou o filtro escolhido na última captura.
function resetCameraSession(categoryId=app.selectedCategory){
  stopCamera();
  clearCapturedPhoto();
  clearGalleryPhoto();
  app.selectedCategory=categoryId;
  app.selectedFilter=app.filters.find(f=>f.category_id===categoryId&&f.active)?.id||null;
  app.facing='environment';
  app.page='camera';
  render();
  window.scrollTo(0,0);
}
function backToCamera(){resetCameraSession();}
function exitAdminTest(){
  stopCamera();clearCapturedPhoto();clearGalleryPhoto();
  app.adminTest.active=false;
  app.page='test-filters';
  app.selectedCategory=null;app.selectedFilter=null;
  render();window.scrollTo(0,0);
}
function navigate(page){document.body.classList.remove('mobile-menu-lock');if(app.page==='camera'&&page!=='camera')stopCamera();if(page!=='preview')clearCapturedPhoto();if(page!=='camera')clearGalleryPhoto();app.page=page;app.selectedFilter=null;render();window.scrollTo(0,0);}
function studioCredits(extraClass=''){
  return `<footer class="studio-credits ${extraClass}" aria-label="Créditos do aplicativo">
    <span>Desenvolvido por <strong>@henriquedomarketing</strong></span>
    <span>Desde 2025 · Todos os direitos reservados.</span>
  </footer>`;
}
function authMarkup(){return `<div class="auth-layout"><div class="auth-card"><div class="brand"><span class="brand-mark fs-logo-mark"><img src="./assets/filtros-studio-mark.svg" alt="" aria-hidden="true"></span><span>Filtros<small>STUDIO</small></span></div><h1>Bem-vindo de volta</h1><p class="muted">Entre para acessar seu painel ou os filtros da sua empresa.</p><form class="form" id="authForm">${field('login','Nome de usuário','','text')}${field('password','Senha','','password',true,0)}<button class="btn btn-primary btn-full" type="submit">Entrar</button><div id="authError" class="auth-error"></div></form><a class="auth-support-link" href="https://wa.me/5544997497915?text=${encodeURIComponent('Olá! Preciso de suporte com o Filtros Studio.')}" target="_blank" rel="noopener noreferrer" aria-label="Tire suas dúvidas pelo WhatsApp"><svg class="auth-whatsapp-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12.04 2a9.9 9.9 0 0 0-8.5 15.01L2 22l5.12-1.48A9.96 9.96 0 1 0 12.04 2Zm0 18.05a8.08 8.08 0 0 1-4.11-1.12l-.3-.18-3.04.88.91-2.96-.2-.31a8.09 8.09 0 1 1 6.74 3.69Zm4.45-6.06c-.24-.12-1.43-.71-1.65-.79-.22-.08-.38-.12-.54.12-.16.24-.62.79-.76.95-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.92-1.19-.71-.63-1.19-1.41-1.33-1.65-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.47-.39-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.11.15 1.53.09.47-.07 1.43-.58 1.63-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"/></svg><span>Tire suas dúvidas</span></a></div>${studioCredits('studio-credits-auth')}</div>`}
function layout(content){const admin=app.profile?.role==='admin';
  const testing=admin&&app.adminTest.active&&['camera','preview'].includes(app.page);
  if(!admin||testing){
    const testingCompany=testing?app.companies.find(c=>c.id===app.adminTest.companyId):null;
    const shownCategories=testing?app.categories.filter(c=>c.company_id===app.adminTest.companyId):app.categories;
    const home=app.page==='categories';
    const type=home?'is-home':app.page==='preview'?'is-preview':'is-camera';
    const clientBrand=home
      ? `<div class="client-brand client-brand-without-icon client-brand-with-studio-logo">
          <span class="client-header-studio-logo" aria-hidden="true"><img src="./assets/filtros-studio-mark.svg" alt="" decoding="async"></span>
          <span class="client-brand-copy"><strong>Filtros Studio</strong><small>FILTROS PERSONALIZADOS</small></span>
        </div>`
      : `<div class="client-brand client-platform-brand">
          <span class="client-brand-mark client-platform-mark fs-logo-mark"><img src="./assets/filtros-studio-mark.svg" alt="" aria-hidden="true"></span>
          <span class="client-brand-copy"><strong>Filtros</strong><small>STUDIO</small></span>
        </div>`;
    const cameraMode=type==='is-camera';
    const cameraDrawer=cameraMode?`<div class="client-camera-menu-backdrop" data-act="close-client-menu" aria-hidden="true"></div>
      <aside class="client-camera-drawer" id="clientCameraDrawer" style="${brandStyle(testing?testingCompany:app.company)}" aria-label="Menu de categorias" aria-hidden="true" inert>
        <div class="client-camera-drawer-heading"><strong>Filtros Studio</strong>
          <button type="button" class="client-camera-drawer-close" data-act="close-client-menu" aria-label="Fechar menu">✕</button>
        </div>
        <button type="button" class="client-camera-drawer-home" data-act="${testing?'exit-admin-test':'back-categories'}">
          <span aria-hidden="true">⌂</span><strong>${testing?'Voltar aos testes':'Página inicial'}</strong><span class="client-drawer-chevron" aria-hidden="true">›</span>
        </button>
        <p class="client-camera-drawer-label">CATEGORIAS</p>
        <nav class="client-camera-drawer-list" aria-label="Categorias da empresa">
          ${shownCategories.map(c=>`<button type="button" class="client-camera-drawer-category ${app.selectedCategory===c.id?'selected':''}" data-act="client-switch-category" data-id="${escapeHtml(c.id)}" ${app.selectedCategory===c.id?'aria-current="page"':''}>${escapeHtml(c.name)}<span aria-hidden="true">›</span></button>`).join('')}
        </nav>
        <div class="client-camera-drawer-bottom">
          ${testing?'<button type="button" data-act="exit-admin-test">← <span>Encerrar teste e voltar ao painel</span></button>':'<button type="button" data-act="logout">↪ <span>Sair da conta</span></button>'}
        </div>
      </aside>`:'';
    return `<div class="client-app ${type} ${testing?'is-admin-test':''}" ${home?`style="${brandStyle(app.company)}"`:''}>
      ${cameraMode?`<header class="client-camera-header" style="${brandStyle(testing?testingCompany:app.company)}">
        <button type="button" class="client-camera-menu-toggle" data-act="open-client-menu" aria-label="Abrir menu de categorias" aria-controls="clientCameraDrawer" aria-expanded="false"><span aria-hidden="true">☰</span></button>
        <div class="client-top-filters" role="group" aria-label="Filtros disponíveis para esta categoria">
          ${app.filters.filter(f=>f.category_id===app.selectedCategory&&f.active).map(f=>`<button type="button" class="client-filter-choice ${app.selectedFilter===f.id?'active':''}" data-act="choose-filter" data-id="${escapeHtml(f.id)}" aria-label="Selecionar filtro ${escapeHtml(f.name)}" aria-pressed="${app.selectedFilter===f.id}">
            <span class="client-filter-circle"><img data-img="${escapeHtml(f.id)}" alt="" loading="lazy"></span>
            <span class="client-filter-name">${escapeHtml(f.name)}</span>
          </button>`).join('')||'<span class="client-top-filters-empty">Nenhum filtro disponível</span>'}
        </div>
      </header>`:type==='is-preview'?`<header class="client-preview-header">
        <button type="button" class="client-preview-back" data-act="photo-back" aria-label="Voltar para a câmera"><span aria-hidden="true">←</span> Voltar</button>
      </header>`:`<header class="client-header">
        ${clientBrand}
        <button type="button" class="client-logout" data-act="logout" aria-label="Sair da conta">Sair</button>
      </header>`}
      <main class="client-content">${content}</main>
      ${cameraMode?'':studioCredits('client-footer')}
      ${cameraDrawer}
    </div>`;
  }
  const menu=[['dashboard','◫ Visão geral'],['clients','♙ Clientes'],['filters','▧ Filtros PNG'],['test-filters','◉ Testar filtros'],['finance','▤ Financeiro'],['settings','⚙ Configurações']];
  return `<div class="layout admin-layout ${app.adminSensitiveHidden?'admin-sensitive-hidden':''}" id="adminLayout">
    <button type="button" class="mobile-menu-backdrop" data-act="close-mobile-menu" tabindex="-1" aria-label="Fechar menu"></button>
    <aside class="sidebar" id="adminSidebar" aria-label="Menu administrativo">
      <div class="admin-sidebar-head">
        <div class="brand"><span class="brand-mark fs-logo-mark"><img src="./assets/filtros-studio-mark.svg" alt="" aria-hidden="true"></span><span>Filtros<small>STUDIO</small></span></div>
        <button type="button" class="sidebar-close" data-act="close-mobile-menu" aria-label="Fechar menu">✕</button>
      </div>
      <nav aria-label="Navegação do painel">${menu.map(([value,title])=>`<button class="nav-btn ${app.page===value?'active':''}" data-nav="${value}">${title}</button>`).join('')}</nav>
      <div class="sidebar-bottom"><b>Administrador</b><p>${escapeHtml(app.user?.email)}</p><button class="btn btn-full" data-act="logout">Sair da conta</button></div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div class="admin-topbar-start">
          <button type="button" class="mobile-menu-toggle" data-act="open-mobile-menu" aria-label="Abrir menu" aria-controls="adminSidebar" aria-expanded="false">
            <span aria-hidden="true">☰</span>
          </button>
          <div class="admin-breadcrumb">Workspace / <strong>Painel administrativo</strong></div>
        </div>
        <button type="button" class="admin-privacy-toggle" data-act="toggle-admin-sensitive"
          aria-label="${app.adminSensitiveHidden?'Mostrar números do painel':'Desfocar números do painel'}"
          aria-pressed="${app.adminSensitiveHidden}" title="${app.adminSensitiveHidden?'Mostrar números':'Desfocar números'}">
          <svg class="admin-eye-on" viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          <svg class="admin-eye-off" viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10.6 5.1A11 11 0 0 1 12 5c6.5 0 10 7 10 7a15 15 0 0 1-3.1 3.8"/><path d="M6.1 6.5C3.5 8.3 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5.1-1.5"/><path d="M10 10a3 3 0 0 0 4 4"/><path d="M3 3l18 18"/>
          </svg>
        </button>
        <div class="topbar-right"><span class="chip">Conta autenticada</span><button class="btn" data-act="logout">Sair</button></div>
      </header>
      <main class="content">${content}</main>
      ${studioCredits('studio-credits-admin')}
    </div>
  </div>${app.modal?`<div class="overlay" id="overlay"><div class="modal ${app.modal.formId==='editFilterForm'?'modal-filter-preview':''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(app.modal.title)}"><div class="modal-head"><h2>${escapeHtml(app.modal.title)}</h2><button class="btn" data-act="close-modal">✕</button></div>${app.modal.content}</div></div>`:''}`;
}
function table(headings,rows){return `<div class="table-wrap"><table class="table"><thead><tr>${headings.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td class="empty" colspan="${headings.length}">Nenhum registro encontrado</td></tr>`}</tbody></table></div>`}
function dashboard(){const overdue=app.invoices.filter(i=>dueStatus(i)==='overdue'),unpaid=app.invoices.filter(i=>i.status==='pending');return header('DASHBOARD','Visão geral','Os indicadores abaixo são calculados a partir dos seus dados reais.',button('Cadastrar cliente','add-client'))+`<div class="stats">${stat('Clientes',app.companies.length,'Máximo permitido: 100')}${stat('Clientes ativos',app.companies.filter(x=>x.active).length,'Contas habilitadas')}${stat('Filtros PNG',app.filters.length,'Arquivos cadastrados')}${stat('A receber',brl(unpaid.reduce((sum,i)=>sum+Number(i.amount),0)),unpaid.length+' cobranças abertas • '+overdue.length+' vencidas')}</div>`+`<div class="card"><h2>Próximos vencimentos</h2>${table(['CLIENTE','VENCIMENTO','VALOR','STATUS'],app.invoices.slice().filter(i=>i.status==='pending').sort((a,b)=>a.due_date.localeCompare(b.due_date)).slice(0,8).map(i=>`<tr><td><b>${escapeHtml(companyName(i.company_id))}</b></td><td>${sensitiveValue(dateBR(i.due_date))}</td><td>${sensitiveValue(brl(i.amount))}</td><td>${badge(dueStatus(i))}</td></tr>`).join(''))}</div>`}
function clients(){return header('GERENCIAMENTO','Clientes','Cada empresa terá seu próprio login e seus próprios filtros.',button('Novo cliente','add-client'))+`<div class="card">${table(['CLIENTE','SITUAÇÃO','MENSALIDADE','VENCIMENTO','AÇÕES'],app.companies.map(c=>`<tr><td><div class="company-admin-name"><span class="company-admin-logo">${brandImg(c,'company-admin-logo-img')||'<span>▣</span>'}</span><span><b>${escapeHtml(c.name)}</b><small>Usuário: ${escapeHtml(c.login_username||'Não configurado')}</small></span></div></td><td>${badge(c.access_paused?'paused':c.active?'active':'inactive')}</td><td>${Number(c.monthly_fee)>0?sensitiveValue(brl(c.monthly_fee)):'<span class="free-client-label">Gratuito / isento</span>'}</td><td>${Number(c.monthly_fee)>0&&c.next_due_date?sensitiveValue(dateBR(c.next_due_date)):'—'}</td><td><div class="actions">${action('edit-client',c.id,'Editar')}${action('toggle-client-access',c.id,c.access_paused?'Reativar acesso':'Pausar acesso',c.access_paused?'client-access-resume':'client-access-pause')}${action('reset-password',c.id,'Nova senha')}${action('remove-client',c.id,'Excluir','danger')}</div></td></tr>`).join(''))}</div>`}


function orderedCategoriesForCompany(companyId){
  return app.categories.filter(c=>c.company_id===companyId).sort((a,b)=>
    Number(a.sort_order)-Number(b.sort_order)||
    String(a.created_at||'').localeCompare(String(b.created_at||''))||
    a.id.localeCompare(b.id));
}
function categoriesSection(){
  const selected=app.companies.find(c=>c.id===app.categoryOrderCompanyId)||
    app.companies.find(c=>app.categories.some(cat=>cat.company_id===c.id))||
    app.companies[0]||null;
  const companyId=selected?.id||null;
  app.categoryOrderCompanyId=companyId;
  const cats=orderedCategoriesForCompany(companyId);
  const rows=cats.map((c,i)=>{
    const count=app.filters.filter(f=>f.category_id===c.id).length;
    return `<tr data-category-row data-category-id="${escapeHtml(c.id)}" data-company-id="${escapeHtml(companyId)}">
      <td class="category-order-grip-cell"><button type="button" class="category-drag-handle" data-category-drag-handle title="Segure e arraste para reordenar" aria-label="Arrastar categoria ${escapeHtml(c.name)}">⠿</button></td>
      <td><b>${escapeHtml(c.name)}</b></td>
      <td>${escapeHtml(companyName(c.company_id))}</td>
      <td><span class="category-count">${count} ${count===1?'filtro':'filtros'}</span></td>
      <td><div class="actions category-actions">
        <button type="button" class="small-action category-move-button" data-act="category-move-up" data-id="${escapeHtml(c.id)}" aria-label="Subir ${escapeHtml(c.name)}" title="Subir" ${i===0?'disabled':''}>↑</button>
        <button type="button" class="small-action category-move-button" data-act="category-move-down" data-id="${escapeHtml(c.id)}" aria-label="Descer ${escapeHtml(c.name)}" title="Descer" ${i===cats.length-1?'disabled':''}>↓</button>
        ${action('edit-category',c.id,'Editar')}
        ${action('remove-category',c.id,'Excluir','danger')}
      </div></td>
    </tr>`;
  }).join('');
  const selector=app.companies.length?`<label class="category-company-picker" for="categoryOrderCompany"><span>Empresa</span><select id="categoryOrderCompany" aria-label="Empresa para ordenar categorias">${app.companies.map(c=>option(c.id,c.name,c.id===companyId)).join('')}</select></label>`:'';
  return `<div class="card category-management">
    <div class="toolbar"><div><h2>Categorias</h2><p class="muted">Segure ⠿ e arraste as categorias para escolher a ordem exibida ao cliente.</p></div><button class="btn" type="button" data-act="add-category">＋ Nova categoria</button></div>
    <div class="category-order-controls">${selector}<span class="category-order-hint">A ordem é salva automaticamente. Alternativa: use as setas ↑ ↓.</span></div>
    <div class="table-wrap"><table class="table category-sort-table"><thead><tr><th>ORDEM</th><th>CATEGORIA</th><th>EMPRESA</th><th>FILTROS</th><th>AÇÕES</th></tr></thead><tbody id="categorySortBody" data-company-id="${escapeHtml(companyId||'')}">${rows||'<tr><td class="empty" colspan="5">Nenhuma categoria para esta empresa. Crie uma categoria ou envie um PNG.</td></tr>'}</tbody></table></div>
  </div>`;
}


async function persistCategoryOrder(companyId,orderedIds){
  if(app.orderSaving)return;
  const current=orderedCategoriesForCompany(companyId);
  if(!companyId||orderedIds.length!==current.length||
    new Set(orderedIds).size!==orderedIds.length||
    orderedIds.some(id=>!current.some(c=>c.id===id)))
    throw new Error('Lista de categorias inválida. Atualize a página para tentar novamente.');
  if(orderedIds.every((id,i)=>id===current[i].id))return;
  app.orderSaving=true;
  try{
    const {error}=await api.rpc('reorder_company_categories',{
      p_company_id:companyId,p_category_ids:orderedIds
    });
    if(error)throw error;
    await loadData();
    toast('Ordem salva! As categorias já aparecem assim para os clientes.');
  }catch(error){
    await loadData();
    throw error;
  }finally{app.orderSaving=false;}
}
async function moveCategoryByButton(categoryId,direction){
  if(app.profile?.role!=='admin'||app.page!=='filters'||app.orderSaving)return;
  const cat=app.categories.find(c=>c.id===categoryId);
  if(!cat||cat.company_id!==app.categoryOrderCompanyId)return;
  const ids=orderedCategoriesForCompany(cat.company_id).map(c=>c.id);
  const from=ids.indexOf(categoryId),to=from+direction;
  if(from<0||to<0||to>=ids.length)return;
  [ids[from],ids[to]]=[ids[to],ids[from]];
  await persistCategoryOrder(cat.company_id,ids);
}
let categoryPointerDrag=null;
function categoryOrderPointerDown(event){
  const handle=event.target.closest?.('[data-category-drag-handle]');
  if(!handle||app.page!=='filters'||app.profile?.role!=='admin'||
     app.orderSaving||categoryPointerDrag||handle.disabled)return;
  if(event.pointerType==='mouse'&&event.button!==0)return;
  const row=handle.closest('tr[data-category-row]');
  if(!row||row.dataset.companyId!==app.categoryOrderCompanyId)return;
  categoryPointerDrag={
    pointerId:event.pointerId,handle,row,companyId:row.dataset.companyId,
    startY:event.clientY,moved:false
  };
  try{handle.setPointerCapture(event.pointerId);}catch{}
}
function categoryOrderPointerMove(event){
  const drag=categoryPointerDrag;
  if(!drag||drag.pointerId!==event.pointerId||!drag.row.isConnected)return;
  if(!drag.moved&&Math.abs(event.clientY-drag.startY)<7)return;
  event.preventDefault();
  drag.moved=true;
  drag.row.classList.add('category-row-dragging');
  const hovered=document.elementFromPoint(event.clientX,event.clientY)?.closest('tr[data-category-row]');
  if(!hovered||hovered===drag.row||hovered.parentElement!==drag.row.parentElement)return;
  const rect=hovered.getBoundingClientRect();
  if(event.clientY>rect.top+rect.height/2)hovered.after(drag.row);
  else hovered.before(drag.row);
}
async function categoryOrderPointerEnd(event,cancel=false){
  const drag=categoryPointerDrag;
  if(!drag||drag.pointerId!==event.pointerId)return;
  categoryPointerDrag=null;
  drag.row.classList.remove('category-row-dragging');
  try{if(drag.handle.hasPointerCapture(event.pointerId))drag.handle.releasePointerCapture(event.pointerId);}catch{}
  if(!drag.moved)return;
  if(cancel){render();return;}
  const ordered=[...drag.row.parentElement.querySelectorAll('tr[data-category-row]')]
    .map(row=>row.dataset.categoryId);
  try{await persistCategoryOrder(drag.companyId,ordered);}
  catch(error){toast(errorMessage(error));}
}

function filters(){
  const availableCompanies=app.companies;
  const selectedCompany=availableCompanies.some(c=>c.id===app.filterLibraryCompanyId)?app.filterLibraryCompanyId:'';
  if(!selectedCompany)app.filterLibraryCompanyId='';
  const availableCategories=app.categories.filter(c=>!selectedCompany||c.company_id===selectedCompany);
  const selectedCategory=availableCategories.some(c=>c.id===app.filterLibraryCategoryId)?app.filterLibraryCategoryId:'';
  if(!selectedCategory)app.filterLibraryCategoryId='';
  const visible=app.filters.filter(f=>(!selectedCompany||f.company_id===selectedCompany)&&(!selectedCategory||f.category_id===selectedCategory));
  const selectors=`<div class="filter-library-toolbar">
    <label>Empresa <select id="filterLibraryCompany" aria-label="Filtrar PNGs por empresa">
      ${option('','Todas as empresas',!selectedCompany)}
      ${availableCompanies.map(c=>option(c.id,c.name,c.id===selectedCompany)).join('')}
    </select></label>
    <label>Categoria <select id="filterLibraryCategory" aria-label="Filtrar PNGs por categoria">
      ${option('','Todas as categorias',!selectedCategory)}
      ${availableCategories.map(c=>option(c.id,`${companyName(c.company_id)} · ${c.name}`,c.id===selectedCategory)).join('')}
    </select></label>
    <span class="filter-library-count">${visible.length} ${visible.length===1?'filtro encontrado':'filtros encontrados'}</span>
  </div>`;
  return header('BIBLIOTECA','Filtros PNG','Gerencie categorias e envie os filtros de cada empresa em um só lugar.',button('Enviar PNG','add-filter'))+
    categoriesSection()+
    `<div class="card filter-library-section">
      <div class="toolbar"><div><h2>Filtros cadastrados</h2><p class="muted">Clique em um PNG para ampliar, substituir, mudar a categoria ou excluir.</p></div></div>
      ${selectors}
      ${visible.length?`<div class="filters-grid">${visible.map(f=>`<article class="filter-card">
        <button type="button" class="filter-card-open" data-act="view-filter" data-id="${escapeHtml(f.id)}" aria-label="Visualizar e gerenciar ${escapeHtml(f.name)}">
          <span class="filter-image"><img data-img="${escapeHtml(f.id)}" alt="" loading="lazy"></span>
          <span class="filter-card-zoom" aria-hidden="true">⤢ Ampliar PNG</span>
        </button>
        <div class="filter-card-info">
          <b title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</b>
          <small title="${escapeHtml(companyName(f.company_id))} · ${escapeHtml(categoryName(f.category_id))}">${escapeHtml(companyName(f.company_id))} · ${escapeHtml(categoryName(f.category_id))}</small>
          <button type="button" class="small-action filter-card-manage" data-act="view-filter" data-id="${escapeHtml(f.id)}">Visualizar e editar</button>
        </div>
      </article>`).join('')}</div>`:'<div class="empty">Nenhum filtro nesta seleção. Escolha outra empresa ou categoria.</div>'}
    </div>`;
}
function testFilters(){
  const company=app.companies.find(c=>c.id===app.adminTest.companyId)||app.companies[0]||null;
  const companyId=company?.id||null;
  const cats=app.categories.filter(c=>c.company_id===companyId);
  const category=cats.find(c=>c.id===app.adminTest.categoryId)||cats[0]||null;
  app.adminTest.companyId=companyId;
  app.adminTest.categoryId=category?.id||null;
  const entries=app.filters.filter(f=>f.company_id===companyId&&f.category_id===category?.id&&f.active);
  const companyField=`<div class="field"><label for="testCompanySelect">Empresa</label><select id="testCompanySelect" ${app.companies.length?'':'disabled'}>${app.companies.map(c=>option(c.id,c.name,c.id===companyId)).join('')}</select></div>`;
  const categoryField=`<div class="field"><label for="testCategorySelect">Categoria</label><select id="testCategorySelect" ${cats.length?'':'disabled'}>${cats.map(c=>option(c.id,c.name,c.id===category?.id)).join('')}</select></div>`;
  const thumbs=entries.map(f=>`<div class="test-filter-item"><div class="test-filter-thumb"><img data-img="${escapeHtml(f.id)}" alt="Prévia do filtro ${escapeHtml(f.name)}"></div><span>${escapeHtml(f.name)}</span></div>`).join('');
  return header('FERRAMENTAS','Testar filtros','Experimente os filtros de cada cliente sem sair da sua conta de administrador.')+
    `<div class="card admin-test-card">
      <div class="admin-test-heading"><span class="admin-test-symbol">◉</span><div><h2>Prévia do cliente</h2><p class="muted">Escolha empresa e categoria para abrir a mesma câmera usada pelos funcionários.</p></div></div>
      <div class="admin-test-selection">${companyField}${categoryField}</div>
      <div class="admin-test-summary"><div><strong>${entries.length}</strong> ${entries.length===1?'filtro disponível':'filtros disponíveis'}${company?' • '+escapeHtml(company.name):''}</div>
        ${category?'<button type="button" class="btn btn-primary" data-act="start-admin-test">◉ Abrir câmera para testar</button>':'<button type="button" class="btn btn-primary" disabled>◉ Abrir câmera para testar</button>'}
      </div>
      ${thumbs?`<div class="admin-test-filter-thumbs" aria-label="Filtros nesta categoria">${thumbs}</div>`:'<p class="muted admin-test-empty">Sem filtros ativos nesta categoria. Cadastre um PNG em Filtros PNG e volte para testar.</p>'}
      <p class="admin-test-explanation">Fotografe, importe imagens da galeria, alterne filtros e gere o resultado em 1080 × 1920. Você permanece conectado como administrador, sem alterar cadastros.</p>
    </div>`;
}
function finance(){const pending=app.invoices.filter(x=>x.status==='pending'),paid=app.invoices.filter(x=>x.status==='paid'),late=pending.filter(x=>x.due_date<today());return header('COBRANÇAS','Financeiro','Mensalidades sincronizadas com os clientes e cobranças manuais; sem integração bancária.',button('Nova cobrança','add-invoice'))+`<div class="stats">${stat('A receber',brl(pending.reduce((s,x)=>s+Number(x.amount),0)),pending.length+' cobranças abertas')}${stat('Recebido',brl(paid.reduce((s,x)=>s+Number(x.amount),0)),paid.length+' pagamentos registrados')}${stat('Atrasado',brl(late.reduce((s,x)=>s+Number(x.amount),0)),late.length+' cobranças vencidas')}${stat('Empresas',app.companies.length,'Clientes cadastrados')}</div><div class="card">${table(['CLIENTE','TIPO','VENCIMENTO','VALOR','STATUS','AÇÕES'],app.invoices.map(x=>`<tr><td><b>${escapeHtml(companyName(x.company_id))}</b></td><td>${x.origin==='monthly'?'Mensalidade':'Manual'}</td><td>${sensitiveValue(dateBR(x.due_date))}</td><td>${sensitiveValue(brl(x.amount))}</td><td>${badge(dueStatus(x))}</td><td><div class="actions">${action('toggle-paid',x.id,x.status==='paid'?'Reabrir':'Marcar pago')}${x.origin==='monthly'?action('edit-client',x.company_id,'Editar mensalidade'):action('edit-invoice',x.id,'Editar')+action('remove-invoice',x.id,'Excluir','danger')}</div></td></tr>`).join(''))}</div>`}
function settings(){const branding=app.settings.branding||{};return header('PERSONALIZAÇÃO','Configurações','Altere o nome da plataforma e o WhatsApp de suporte.')+`<div class="card"><form id="settingsForm" class="form">${field('appName','Nome da plataforma',branding.appName||'Filtros Studio')}${field('supportWhatsapp','WhatsApp de suporte',branding.supportWhatsapp||'', 'tel',false)}<p class="settings-support-hint">Informe o DDD e o número do suporte. Esse contato aparecerá automaticamente para todos os clientes com acesso pausado. Exemplo: (44) 99999-9999. Não é necessário editar cada cliente.</p><button type="submit" class="btn btn-primary">Salvar configurações</button></form><p class="note">O limite de 100 clientes é aplicado pelo banco. As senhas ficam no Supabase Auth e os PNGs em um armazenamento privado.</p></div>`}
function clientCategories(){
  return `<section class="client-home">
    <div class="client-home-heading">
      <div class="client-home-heading-copy">
        <h1>Bem-vindo!</h1>
        <p>Escolha uma categoria, selecione seu filtro e crie fotos para suas redes sociais.</p>
      </div>
    </div>
    <div class="client-category-grid">${app.categories.map(c=>{
      const count=app.filters.filter(f=>f.category_id===c.id&&f.active).length;
      return `<button type="button" data-act="open-category" data-id="${escapeHtml(c.id)}" class="client-category-item">
        <span class="client-category-name">${escapeHtml(c.name)}</span>
        <small class="client-category-count">${count} ${count===1?'filtro disponível':'filtros disponíveis'}</small>
        <span class="client-category-arrow" aria-hidden="true">›</span>
      </button>`;
    }).join('')||'<p class="client-empty">Nenhuma categoria disponível por enquanto. Fale com o administrador.</p>'}</div>
  </section>`;
}
function cameraView(){
  const fromGallery=Boolean(app.galleryPhoto);
  return `<section class="client-camera-screen">
    <div class="client-viewfinder-wrap">
      <div class="camera-frame client-viewfinder">
        ${fromGallery
          ? `<img id="galleryBase" class="client-gallery-image" src="${escapeHtml(app.galleryPhoto.url)}" alt="Foto escolhida na galeria, recortada ao centro em formato Stories">`
          : '<video id="cameraVideo" autoplay playsinline muted></video>'}
        <img class="hidden" id="cameraOverlay" alt="Filtro sobre a foto">
        ${fromGallery?'<button type="button" class="client-gallery-back" data-act="use-camera" aria-label="Voltar à câmera sem a foto importada"><span aria-hidden="true">←</span> Voltar à câmera</button>':''}
        ${fromGallery?'<span class="client-gallery-indicator">FOTO DA GALERIA</span>':''}
      </div>
    </div>
    <div class="client-photo-controls">
      <button type="button" data-act="${fromGallery?'use-camera':'flip-camera'}" class="client-control-secondary" aria-label="${fromGallery?'Voltar para câmera':'Alternar câmera'}" title="${fromGallery?'Voltar para câmera':'Alternar câmera'}"><span class="client-control-icon">${fromGallery?'←':'⟳'}</span><small>${fromGallery?'Voltar':'Alternar'}</small></button>
      <button type="button" data-act="capture" class="client-shutter" aria-label="${fromGallery?'Concluir foto e abrir opções de salvar e compartilhar':'Fotografar'}" title="${fromGallery?'Concluir foto e compartilhar':'Fotografar'}"><span></span></button>
      <button type="button" data-act="pick-gallery" class="client-control-secondary" aria-label="Escolher foto da galeria" title="Escolher foto da galeria"><span class="client-control-icon" aria-hidden="true"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m3 17 5.8-5.8 4.1 4.1 2.4-2.4L21 18"/></svg></span><small>Galeria</small></button>
      <input id="galleryPhotoInput" class="client-gallery-file-input" type="file" accept="image/*,.heic,.heif" aria-label="Escolher foto da galeria" tabindex="-1">
    </div>
    ${fromGallery?`<button type="button" class="client-gallery-finish" data-act="finish-gallery" aria-label="Concluir foto com filtro e abrir opções para salvar e compartilhar">
      <span class="client-gallery-finish-icon" aria-hidden="true">✓</span>
      <span class="client-gallery-finish-copy"><strong>Salvar ou compartilhar</strong><small>Concluir foto com o filtro selecionado</small></span>
      <span class="client-gallery-finish-arrow" aria-hidden="true">›</span>
    </button>`:''}
    ${studioCredits('client-camera-credits')}
  </section>`;
}

function previewView(){
  if(!app.captureData)return '<div class="client-empty">Não há fotografia disponível.</div>';
  return `<section class="client-result" aria-label="Resultado da fotografia">
    <div class="client-result-heading"><span class="client-eyebrow">FOTO FINALIZADA · 1080 × 1920</span>
      <h1>Sua foto ficou pronta! <span aria-hidden="true">✨</span></h1>
      <p>Confira o resultado com o filtro aplicado e escolha como deseja usar.</p>
    </div>
    <figure class="client-result-preview"><img src="${escapeHtml(app.captureData.url)}" alt="Prévia da foto capturada com o filtro aplicado"><figcaption>Pronta para publicar nos Stories</figcaption></figure>
    <div class="client-result-actions">
      <button type="button" class="client-result-btn client-result-share" data-act="photo-share"><span aria-hidden="true">↗</span> Compartilhar foto</button>
      <div class="client-result-grid">
        <button type="button" class="client-result-btn client-result-instagram" data-act="photo-instagram"><span aria-hidden="true">◎</span> Instagram Stories</button>
        <button type="button" class="client-result-btn client-result-whatsapp" data-act="photo-whatsapp"><span aria-hidden="true">✆</span> WhatsApp</button>
      </div>
      <button type="button" class="client-result-btn client-result-save" data-act="photo-save"><span aria-hidden="true">↓</span> Salvar no celular</button>
      <div class="client-result-secondary">
        <button type="button" data-act="photo-retake">↻ Nova foto</button>
        <button type="button" data-act="photo-change-filter">◉ Trocar filtro</button>
      </div>
    </div>
    <p class="client-result-note">Instagram e WhatsApp dependem das opções disponíveis no compartilhamento do seu celular. No iPhone, use <b>Salvar Imagem</b> ou <b>Salvar em Arquivos</b> para guardar a foto.</p>
  </section>`;
}

function supportContactMarkup(){
  const phone=String(app.settings?.branding?.supportWhatsapp||'').trim();
  const digits=phone.replace(/\D/g,'');
  const waDigits=digits.length===10||digits.length===11?'55'+digits:digits;
  const valid=(waDigits.length===12||waDigits.length===13)&&waDigits.startsWith('55');
  const contact=phone?'<p class="support-phone"><span>WhatsApp do suporte</span><strong>'+escapeHtml(phone)+'</strong></p>':
    '<p class="muted support-not-configured">O número de suporte ainda não foi informado. Ele aparecerá aqui assim que o administrador o cadastrar.</p>';
  return contact+(valid?'<a class="btn btn-primary support-whatsapp-button" href="https://wa.me/'+waDigits+'?text='+encodeURIComponent('Olá! Gostaria de verificar a situação do acesso da minha empresa ao Filtros Studio.')+'" target="_blank" rel="noopener noreferrer">Falar com suporte pelo WhatsApp</a>':'');
}
function pausedClientView(){
  return '<div class="access-paused-layout">'+
    '<section class="card access-paused-card" role="status" aria-live="polite">'+
      '<div class="access-paused-brand"><span class="brand-mark fs-logo-mark"><img src="./assets/filtros-studio-mark.svg" alt="" aria-hidden="true"></span><strong>Filtros <small>STUDIO</small></strong></div>'+
      '<div class="access-paused-icon" aria-hidden="true">🔒</div>'+
      '<h1>Acesso temporariamente pausado</h1>'+
      '<p class="access-paused-description">O acesso aos filtros desta empresa está temporariamente indisponível. Para verificar sua situação e solicitar a regularização, entre em contato com nosso suporte.</p>'+
      supportContactMarkup()+
      '<div class="access-paused-actions">'+
        '<button type="button" class="btn" data-act="check-client-access">Verificar novamente</button>'+
        '<button type="button" class="btn access-paused-logout" data-act="logout">Sair da conta</button>'+
      '</div></section>'+studioCredits('studio-credits-auth')+'</div>';
}
function waiting(){return `<div class="auth-layout"><div class="card pending"><div class="brand"><span class="brand-mark fs-logo-mark"><img src="./assets/filtros-studio-mark.svg" alt="" aria-hidden="true"></span><span>Filtros Studio</span></div><h2>Conta aguardando ativação</h2><p class="muted">Seu cadastro existe, mas ainda não foi vinculado a uma empresa ou autorizado como administrador. Solicite a ativação ao responsável.</p>${supportContactMarkup()}<button class="btn" data-act="logout">Sair</button></div></div>`}
function render(){
  document.body.classList.remove('mobile-menu-lock','client-camera-menu-lock');
  if(!app.user){$('root').innerHTML=authMarkup();return;}
  if(!app.profile||app.profile.role!=='admin'&&!app.company){$('root').innerHTML=waiting();return;}
  if(app.profile.role!=='admin'&&(app.company?.access_paused||app.company?.active===false)){
    stopCamera();clearCapturedPhoto();clearGalleryPhoto();
    $('root').innerHTML=pausedClientView();return;
  }
  const admin=app.profile.role==='admin';
  const testing=admin&&app.adminTest.active&&['camera','preview'].includes(app.page);
  const content=admin&&!testing
    ? ({dashboard,clients,filters,'test-filters':testFilters,finance,settings}[app.page]||dashboard)()
    : (app.page==='preview'&&app.captureData?previewView():
       app.page==='camera'&&app.selectedCategory?cameraView():clientCategories());
  $('root').innerHTML=layout(content);
  hydrateImages();hydrateBrandLogos();
  if((!admin||testing)&&app.page==='camera'&&app.selectedCategory){
    if(!app.galleryPhoto)startCamera();
    if(app.selectedFilter)selectFilter(app.selectedFilter);
  }
}
async function loadData(){
  if(!app.user)return;
  const {data:profile,error}=await api.from('profiles').select('*').eq('id',app.user.id).single();
  if(error)throw error;
  app.profile=profile;
  const admin=profile.role==='admin';
  if(admin){
    const [a,b,c,d,settings]=await Promise.all([
      api.from('companies').select('*').order('created_at',{ascending:false}),
      api.from('categories').select('*').order('sort_order').order('created_at'),
      api.from('filters').select('*').order('sort_order'),
      api.from('invoices').select('*').order('due_date',{ascending:true}),
      api.from('app_settings').select('*')
    ]);
    for(const result of [a,b,c,d,settings])if(result.error)throw result.error;
    app.companies=a.data;app.categories=b.data;app.filters=c.data;app.invoices=d.data;
    app.settings=Object.fromEntries(settings.data.map(item=>[item.key,item.value]));
    app.page=['categories','camera'].includes(app.page)?'dashboard':app.page;
  }else{
    app.company=null;
    app.categories=[];app.filters=[];
    const support=api.from('app_settings').select('value').eq('key','branding').maybeSingle();
    const company=profile.company_id
      ?api.from('companies').select('*').eq('id',profile.company_id).maybeSingle()
      :Promise.resolve({data:null,error:null});
    const [settings,co]=await Promise.all([support,company]);
    if(settings.error)throw settings.error;
    if(co.error)throw co.error;
    app.settings={branding:settings.data?.value||{}};
    app.company=co.data;
    if(co.data?.active&&!co.data?.access_paused){
      const [cats,filters]=await Promise.all([
        api.from('categories').select('*').eq('company_id',profile.company_id).order('sort_order').order('created_at'),
        api.from('filters').select('*').eq('company_id',profile.company_id).eq('active',true).order('sort_order')
      ]);
      if(cats.error)throw cats.error;
      if(filters.error)throw filters.error;
      app.categories=cats.data;app.filters=filters.data;
    }
    app.page='categories';
  }
  render();
}
async function refresh(){await loadData();toast('Dados atualizados.');}
async function init(){
  // Não restaurar um login anterior após o usuário tocar explicitamente em Sair.
  if(wasExplicitlyLoggedOut()){
    clearStoredAuthSession();
    app.user=null;app.profile=null;app.company=null;
    render();return;
  }
  const {data:{session}}=await api.auth.getSession();
  app.user=session?.user||null;
  if(app.user){try{await loadData()}catch(error){toast(errorMessage(error));$('root').innerHTML=waiting()}}
  else render();
}
const clientUsernamePattern=/^[a-z][a-z0-9_-]{2,31}$/;
function normalizeClientUsername(value){
  const username=String(value||'').trim().toLowerCase();
  if(!clientUsernamePattern.test(username))throw new Error('Use um nome de usuário de 3 a 32 caracteres, começando com uma letra e contendo apenas letras, números, _ ou -.');
  return username;
}
function loginAuthEmail(identifier){
  const value=String(identifier||'').trim().toLowerCase();
  if(value.includes('@')){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw new Error('Informe seu e-mail de administrador corretamente.');
    return value;
  }
  return normalizeClientUsername(value)+'@usuarios.filtros.studio';
}
async function authSubmit(form){
  if(logoutPending){
    const errorNode=$('authError');
    if(errorNode)errorNode.textContent='Aguarde a conclusão da saída e tente novamente.';
    return;
  }
  const data=Object.fromEntries(new FormData(form));$('authError').textContent='';const submit=form.querySelector('button[type=submit]');submit.disabled=true;try{const {data:auth,error}=await api.auth.signInWithPassword({email:loginAuthEmail(data.login),password:data.password});if(error)throw error;setExplicitLogout(false);app.user=auth.user;await loadData();}catch(error){const node=$('authError');if(node)node.textContent=errorMessage(error)}finally{if(submit.isConnected)submit.disabled=false;}}
async function manager(body){
  const {data,error}=await api.functions.invoke('manage-client',{body});
  if(error){
    // Supabase FunctionsHttpError carries a Response in context, not a parsed error.
    // Read the server's JSON safely so a validation error is actionable.
    let details='';
    const response=error.context;
    if(response && typeof response.clone==='function'){
      try{
        const payload=await response.clone().json();
        if(typeof payload?.error==='string')details=payload.error;
        else if(typeof payload?.message==='string')details=payload.message;
      }catch{
        try{details=(await response.clone().text()).slice(0,240)}catch{}
      }
    }
    throw new Error(details||error.message||'Falha na comunicação com o servidor.');
  }
  if(data?.error)throw new Error(data.error);
  return data;
}
function openModal(title,body,formId){app.modal={title,content:body,formId};render();}
function clearFilterDraftUrl(){if(app.filterDraftUrl){URL.revokeObjectURL(app.filterDraftUrl);app.filterDraftUrl=null;}}
function closeModal(){clearFilterDraftUrl();app.modal=null;render();}
// Sem mensalidade, o cliente é gratuito/isento. Não criar vencimento nem cobrança.
function clientBillingFromForm(values){
  const amountText=String(values.monthly_fee??'').trim().replace(',','.');
  const monthly_fee=amountText===''?0:Number(amountText);
  if(!Number.isFinite(monthly_fee)||monthly_fee<0||monthly_fee>100000)
    throw new Error('Informe uma mensalidade válida ou deixe o valor em branco para acesso gratuito.');
  if(monthly_fee===0)return {monthly_fee:0,due_day:10,next_due_date:null};
  const date=String(values.next_due_date??'').trim();
  const rawDay=String(values.due_day??'').trim();
  if(!rawDay&&!date)
    throw new Error('Para um cliente pagante, informe o dia do vencimento ou a data do próximo vencimento.');
  const due_day=rawDay?Number(rawDay):Number(date.slice(8,10));
  if(!Number.isInteger(due_day)||due_day<1||due_day>31)
    throw new Error('O dia de vencimento deve estar entre 1 e 31.');
  return {monthly_fee,due_day,next_due_date:date||null};
}
function companyModal(cid){
  const c=app.companies.find(x=>x.id===cid);
  const logoInfo=c?.logo_path?`<span class="brand-form-current-logo">${brandImg(c,'brand-form-logo-img')}<small>Logo atual da empresa</small></span>`:'';
  const frm=`<form class="form" id="clientForm">
    ${field('name','Nome da empresa',c?.name)}
    ${field('username','Nome de usuário (sem e-mail)',c?.login_username||'','text',true,3)}<p class="username-hint">Use 3 a 32 caracteres, começando com uma letra. Aceita números, _ e -. Ex.: p4veiculos</p>
    ${!c?field('password','Senha inicial (8 caracteres ou mais)','','password',true,8):''}
    <div class="branding-form-section">
      <strong>Identidade visual da empresa</strong>
      <p>Envie a logo original em PNG, no formato que tiver (quadrado, horizontal ou vertical). A imagem manterá a proporção original, sem corte nem distorção. O visual do aplicativo seguirá sempre a identidade oficial do Filtros Studio.</p>
      ${logoInfo}
      <div class="field">
        <label for="companyLogo">Logo PNG — qualquer tamanho e proporção (máximo 2 MB)${c?' — opcional para substituir':''}</label>
        <input id="companyLogo" type="file" name="logo" accept=".png,image/png" ${c?'':'required'}>
      </div>
    </div>
    <div class="optional-billing-section">
      <strong>Financeiro e contato <span>(opcionais)</span></strong>
      <p class="muted">Sem mensalidade, o usuário é gratuito/isento e não gera cobranças. O telefone também pode ficar vazio. Para cobrar, informe um valor e o dia ou a data de vencimento.</p>
      ${field('phone','Telefone/WhatsApp (opcional)',c?.phone||'','tel',false)}
      ${field('monthly_fee','Mensalidade em reais (vazio = gratuito)',Number(c?.monthly_fee)>0?c.monthly_fee:'','number',false).replace('type="number"','type="number" min="0" max="100000" step="0.01" inputmode="decimal"')}
      ${field('due_day','Dia do vencimento (somente pagantes)',Number(c?.monthly_fee)>0?c.due_day:'','number',false).replace('type="number"','type="number" min="1" max="31" step="1"')}
      ${field('next_due_date','Próximo vencimento (opcional)',Number(c?.monthly_fee)>0?c.next_due_date||'':'','date',false)}
    </div>
    ${c?select('active','Situação',option('true','Ativo',c.active)+option('false','Inativo',!c.active)):''}
    ${endForm}</form>`;
  openModal(c?'Editar cliente':'Cadastrar cliente',frm,'clientForm');
  app.modal.recordId=c?.id||null;
}
function categoryModal(cid){
  const c=app.categories.find(x=>x.id===cid);
  const companyField=c
    ? `<div class="field"><label>Empresa</label><div class="category-company-locked">${escapeHtml(companyName(c.company_id))}</div><input type="hidden" name="company_id" value="${escapeHtml(c.company_id)}"></div>`
    : select('company_id','Empresa',companyOptions());
  openModal(c?'Editar categoria':'Nova categoria',
    `<form class="form" id="categoryForm">${companyField}${field('name','Categoria',c?.name||'')}${endForm}</form>`,'categoryForm');
  app.modal.recordId=c?.id||null;
}
function invoiceModal(iid){const i=app.invoices.find(x=>x.id===iid);openModal(i?'Editar cobrança':'Nova cobrança',`<form class="form" id="invoiceForm">${select('company_id','Empresa',companyOptions(i?.company_id))}${field('amount','Valor (R$)',i?.amount??0,'number')}${field('due_date','Vencimento',i?.due_date||today(),'date')}${select('status','Situação',option('pending','Pendente',!i||i.status==='pending')+option('paid','Pago',i?.status==='paid')+option('canceled','Cancelado',i?.status==='canceled'))}${field('notes','Observações',i?.notes||'','text',false)}${endForm}</form>`,'invoiceForm');app.modal.recordId=i?.id||null;}

function filterModal(){
  const content=`<form class="form" id="filterForm">
    ${select('company_id','Empresa',companyOptions())}
    <div class="field">
      <label for="filterCategory">Categoria</label>
      <select name="category_id" id="filterCategory" required></select>
    </div>
    <div class="field filter-new-category hidden" id="filterNewCategoryWrap">
      <label for="filterNewCategory">Nome da nova categoria</label>
      <input id="filterNewCategory" name="new_category_name" type="text" maxlength="100" placeholder="Ex.: Bom Dia, Ofertas, Financiamento">
      <span class="muted">A nova categoria ficará disponível para os próximos filtros desta empresa.</span>
    </div>
    ${field('name','Nome do filtro')}
    ${field('sort_order','Ordem',0,'number')}
    <div class="field"><label>PNG transparente (máximo 12 MB)</label><input type="file" name="file" accept="image/png,.png" required></div>
    <p class="muted">Recomendado: imagem vertical 1080 × 1920, com transparência real.</p>
    ${endForm}
  </form>`;
  openModal('Cadastrar filtro PNG',content,'filterForm');
  updateCategoryOptions();
}
function editFilterModal(filterId){
  if(app.profile?.role!=='admin')return;
  const filter=app.filters.find(f=>f.id===filterId);
  if(!filter)return toast('O filtro não foi encontrado. Atualize o painel.');
  clearFilterDraftUrl();
  const categories=app.categories.filter(c=>c.company_id===filter.company_id)
    .sort((a,b)=>Number(a.sort_order)-Number(b.sort_order));
  const currentCategory=categories.some(c=>c.id===filter.category_id)?filter.category_id:'';
  const content=`<form class="form filter-editor-form" id="editFilterForm">
    <div class="filter-editor-layout">
      <div class="filter-editor-visual">
        <div class="filter-editor-large-preview" id="filterEditorPreview">
          <img data-img="${escapeHtml(filter.id)}" alt="Prévia completa do filtro PNG ${escapeHtml(filter.name)}">
        </div>
        <p class="filter-editor-preview-caption" id="filterEditorPreviewCaption">PNG atual · proporção original preservada</p>
        <button class="filter-editor-bg-toggle" type="button" data-act="toggle-filter-preview-bg" aria-pressed="false">◐ Ver em fundo escuro</button>
      </div>
      <div class="filter-editor-fields">
        <p class="filter-editor-kicker">GERENCIAR FILTRO</p>
        <div class="filter-editor-company"><span>Empresa</span><strong>${escapeHtml(companyName(filter.company_id))}</strong></div>
        ${field('name','Nome do filtro',filter.name)}
        <div class="field"><label for="editFilterCategory">Categoria</label>
          <select id="editFilterCategory" name="category_id" required>
            ${categories.map(c=>option(c.id,c.name,c.id===currentCategory)).join('')}
          </select>
        </div>
        <div class="field"><label for="editFilterFile">Substituir imagem PNG <small>(opcional)</small></label>
          <input id="editFilterFile" name="file" type="file" accept="image/png,.png">
          <small class="filter-editor-file-note">Selecione outro PNG transparente (até 12 MB). Você verá a prévia antes de salvar. Sem arquivo novo, o PNG atual permanece.</small>
        </div>
        <div class="filter-editor-actions">
          <button class="btn btn-primary filter-editor-save" type="submit">Salvar alterações</button>
          <button class="btn" type="button" data-act="close-modal">Cancelar</button>
        </div>
        <button class="small-action danger filter-editor-delete" type="button" data-act="remove-filter" data-id="${escapeHtml(filter.id)}">Excluir este filtro definitivamente</button>
      </div>
    </div>
  </form>`;
  openModal(`Filtro: ${filter.name}`,content,'editFilterForm');
  app.modal.recordId=filter.id;
}

function previewReplacementFilter(file){
  if(app.modal?.formId!=='editFilterForm')return;
  const img=document.querySelector('#filterEditorPreview img');
  const caption=$('filterEditorPreviewCaption');
  if(!img)return;
  clearFilterDraftUrl();
  if(file){
    if(file.type!=='image/png'||file.size>12582912){
      toast('Selecione um PNG de até 12 MB.');
      document.querySelector('#editFilterFile').value='';
    }else{
      app.filterDraftUrl=URL.createObjectURL(file);
      img.removeAttribute('data-img');
      img.src=app.filterDraftUrl;
      if(caption)caption.textContent='Prévia do novo PNG · ainda não foi salvo';
      return;
    }
  }
  const current=app.filters.find(f=>f.id===app.modal.recordId);
  if(current)mediaUrl(current).then(url=>{if(img.isConnected)img.src=url;}).catch(()=>{});
  if(caption)caption.textContent='PNG atual · proporção original preservada';
}

async function saveFilterChanges(form){
  if(app.profile?.role!=='admin')throw Error('Apenas o administrador pode editar filtros.');
  const filter=app.filters.find(f=>f.id===app.modal?.recordId);
  if(!filter)throw Error('Filtro não encontrado. Atualize a página.');
  const name=form.elements.name.value.trim();
  if(!name||name.length>120)throw Error('O nome do filtro deve ter entre 1 e 120 caracteres.');
  const categoryId=form.elements.category_id.value;
  if(!app.categories.some(c=>c.id===categoryId&&c.company_id===filter.company_id))
    throw Error('Escolha uma categoria pertencente à mesma empresa.');
  const file=form.elements.file.files?.[0]||null;
  if(file)await validatePNG(file);
  const replacementPath=file?`${filter.company_id}/${id()}.png`:null;
  let uploaded=false;
  try{
    if(file){
      const {error}=await api.storage.from('company-filters')
        .upload(replacementPath,file,{contentType:'image/png',upsert:false});
      if(error)throw error;
      uploaded=true;
    }
    const payload={name,category_id:categoryId};
    if(replacementPath)payload.storage_path=replacementPath;
    const {data,error}=await api.from('filters').update(payload)
      .eq('id',filter.id).eq('company_id',filter.company_id)
      .eq('storage_path',filter.storage_path).select('id').single();
    if(error)throw error;
    if(!data)throw Error('O filtro foi alterado por outra sessão. Atualize e tente novamente.');
  }catch(error){
    if(uploaded)await api.storage.from('company-filters').remove([replacementPath]);
    throw error;
  }
  if(replacementPath){
    if(app.images.has(filter.id)){
      URL.revokeObjectURL(app.images.get(filter.id));
      app.images.delete(filter.id);
    }
    const {error}=await api.storage.from('company-filters').remove([filter.storage_path]);
    if(error)console.warn('O PNG antigo precisará de limpeza no armazenamento:',error.message);
  }
  clearFilterDraftUrl();
}
function updateCategoryOptions(){
  const form=$('filterForm');if(!form)return;
  const companyId=form.elements.company_id.value;
  const target=$('filterCategory');
  if(!target)return;
  const previous=target.value;
  const existing=app.categories.filter(c=>c.company_id===companyId);
  target.innerHTML=existing.map(c=>option(c.id,c.name,c.id===previous)).join('')+
    option('__new__','＋ Criar nova categoria…',previous==='__new__'||!existing.length);
  if(previous&&[...target.options].some(o=>o.value===previous))target.value=previous;
  else if(!existing.length)target.value='__new__';
  updateNewCategoryField();
}
function updateNewCategoryField(){
  const form=$('filterForm');if(!form)return;
  const isNew=form.elements.category_id.value==='__new__';
  const wrap=$('filterNewCategoryWrap'),field=$('filterNewCategory');
  if(wrap)wrap.classList.toggle('hidden',!isNew);
  if(field){field.required=isNew;field.disabled=!isNew;}
}
async function validatePNG(file){if(!file||file.type!=='image/png'||file.size>12582912)throw Error('Selecione um PNG válido de até 12 MB.');const uri=URL.createObjectURL(file);try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('PNG não reconhecido.'));img.src=uri;});const canvas=document.createElement('canvas');canvas.width=100;canvas.height=178;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,100,178);const pixels=ctx.getImageData(0,0,100,178).data;let transparent=false,visible=false;for(let i=3;i<pixels.length;i+=4){if(pixels[i]<240)transparent=true;if(pixels[i]>15)visible=true;if(transparent&&visible)break;}if(!transparent||!visible)throw Error('O filtro precisa ter elementos visíveis e fundo transparente.');}finally{URL.revokeObjectURL(uri);}}

async function filterUpload(form){
  const file=form.elements.file.files[0];
  await validatePNG(file);
  const companyId=form.elements.company_id.value;
  let categoryId=form.elements.category_id.value;
  if(!app.companies.some(c=>c.id===companyId))throw Error('Selecione uma empresa válida.');
  let createdCategoryId=null;
  let path=null;
  try{
    if(categoryId==='__new__'){
      const name=form.elements.new_category_name.value.trim();
      if(!name||name.length>100)throw Error('Informe o nome da nova categoria (até 100 caracteres).');
      // Nunca criar categoria em empresa diferente daquela escolhida para o PNG.
      const {data,error}=await api.from('categories')
        .insert({company_id:companyId,name})
        .select('id').single();
      if(error)throw error;
      createdCategoryId=data.id;
      categoryId=data.id;
    }else if(!app.categories.some(c=>c.id===categoryId&&c.company_id===companyId)){
      throw Error('Escolha uma categoria válida para esta empresa.');
    }
    path=`${companyId}/${id()}.png`;
    const {error:uploadError}=await api.storage.from('company-filters')
      .upload(path,file,{contentType:'image/png',upsert:false});
    if(uploadError)throw uploadError;
    const payload={company_id:companyId,category_id:categoryId,
      name:form.elements.name.value.trim(),sort_order:Number(form.elements.sort_order.value),storage_path:path};
    const {error}=await api.from('filters').insert(payload);
    if(error)throw error;
  }catch(error){
    if(path)await api.storage.from('company-filters').remove([path]);
    if(createdCategoryId){
      // O envio falhou. Remover apenas a categoria recém-criada e vazia.
      const {count}=await api.from('filters').select('id',{count:'exact',head:true}).eq('category_id',createdCategoryId);
      if(count===0)await api.from('categories').delete().eq('id',createdCategoryId);
    }
    throw error;
  }
}
async function validateCompanyLogo(file){
  if(!file)return;
  if(file.type!=='image/png'||file.size>2*1024*1024||file.size<8)
    throw Error('A logo deve ser um arquivo PNG de até 2 MB.');
  const uri=URL.createObjectURL(file);
  try{
    const img=new Image();
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('A logo selecionada não é um PNG válido.'));img.src=uri;});
    if(!img.naturalWidth||!img.naturalHeight)
      throw Error('A logo PNG selecionada está vazia ou inválida.');
  }finally{URL.revokeObjectURL(uri);}
}
async function uploadCompanyLogo(companyId,file){
  const path=`${companyId}/branding/${id()}.png`;
  const {error}=await api.storage.from('company-filters').upload(path,file,{contentType:'image/png',cacheControl:'3600',upsert:false});
  if(error)throw error;
  return path;
}
async function saveCompanyBrand(companyId,values,logo,oldLogo){
  if(!logo)return;
  const payload={};
  let uploaded=null;
  try{
    if(logo){uploaded=await uploadCompanyLogo(companyId,logo);payload.logo_path=uploaded;}
    const {error}=await api.from('companies').update(payload).eq('id',companyId);
    if(error)throw error;
  }catch(error){
    if(uploaded)await api.storage.from('company-filters').remove([uploaded]);
    throw error;
  }
  if(uploaded&&oldLogo&&oldLogo!==uploaded){
    const {error:cleanup}=await api.storage.from('company-filters').remove([oldLogo]);
    if(cleanup)console.warn('Logo anterior necessita de limpeza:',cleanup.message);
  }
}
async function brandLogoUrl(company){
  if(!company?.logo_path)return null;
  const key='brand:'+company.logo_path;
  if(app.images.has(key))return app.images.get(key);
  const {data,error}=await api.storage.from('company-filters').download(company.logo_path);
  if(error)throw error;
  const uri=URL.createObjectURL(data);
  app.images.set(key,uri);
  return uri;
}
function hydrateBrandLogos(){
  document.querySelectorAll('[data-brand-logo]').forEach(element=>{
    const company=app.companies.find(c=>c.id===element.dataset.brandLogo)||
      (app.company?.id===element.dataset.brandLogo?app.company:null);
    if(!company?.logo_path)return;
    const fallback=()=>{
      if(!element.isConnected)return;
      const parent=element.parentElement;
      const mainLogo=element.classList.contains('client-company-logo');
      element.remove();
      if(mainLogo&&parent&&!parent.querySelector('.client-logo-fallback')){
        const placeholder=document.createElement('span');
        placeholder.className='client-logo-fallback';
        placeholder.textContent=companyInitials(company);
        parent.append(placeholder);
      }
    };
    element.addEventListener('load',()=>{
      if(element.isConnected)element.classList.add('brand-image-ready');
    },{once:true});
    element.addEventListener('error',fallback,{once:true});
    brandLogoUrl(company).then(uri=>{if(element.isConnected)element.src=uri;})
      .catch(fallback);
  });
}

async function handleForm(event){event.preventDefault();const form=event.target;const values=Object.fromEntries(new FormData(form));const button=form.querySelector('button[type=submit]');if(button)button.disabled=true;try{if(form.id==='authForm')return await authSubmit(form);if(form.id==='clientForm'){
  const logo=values.logo instanceof File&&values.logo.size>0?values.logo:null;
  await validateCompanyLogo(logo);
  const c=app.companies.find(x=>x.id===app.modal?.recordId);
  if(c){
    const username=normalizeClientUsername(values.username);
    const billing=clientBillingFromForm(values);
    const payload={name:values.name,phone:String(values.phone||'').trim(),
      ...billing,active:values.active==='true'};
    const {error}=await api.from('companies').update(payload).eq('id',c.id);
    if(error)throw error;
    await saveCompanyBrand(c.id,values,logo,c.logo_path);
    if(c.login_username!==username)await manager({action:'update_username',company_id:c.id,username});
  }else{
    if(!logo)throw Error('Envie a logo da empresa em PNG (até 2 MB).');
    const billing=clientBillingFromForm(values);
    const created=await manager({action:'create',name:values.name,username:normalizeClientUsername(values.username),password:values.password,
      phone:String(values.phone||'').trim(),...billing});
    try{await saveCompanyBrand(created.company_id,values,logo,null);}
    catch(error){
      await loadData();
      throw new Error('Cliente cadastrado, mas a personalização ficou pendente: '+errorMessage(error)+'. Abra Editar para reenviar a logo.');
    }
  }
}if(form.id==='categoryForm'){const p={company_id:values.company_id,name:values.name.trim()};const q=app.modal.recordId?api.from('categories').update(p).eq('id',app.modal.recordId):api.from('categories').insert(p);const {error}=await q;if(error)throw error;}if(form.id==='invoiceForm'){const p={company_id:values.company_id,amount:Number(values.amount),due_date:values.due_date,status:values.status,paid_at:values.status==='paid'?new Date().toISOString():null,notes:values.notes||null};const q=app.modal.recordId?api.from('invoices').update(p).eq('id',app.modal.recordId):api.from('invoices').insert(p);const {error}=await q;if(error)throw error;}if(form.id==='filterForm')await filterUpload(form);if(form.id==='editFilterForm')await saveFilterChanges(form);if(form.id==='passwordForm')await manager({action:'reset_password',company_id:app.modal.recordId,password:values.password});if(form.id==='settingsForm'){const support=String(values.supportWhatsapp||'').trim();const digits=support.replace(/\D/g,'');if(support&&!(digits.length===10||digits.length===11||digits.length===12&&digits.startsWith('55')||digits.length===13&&digits.startsWith('55')))throw new Error('Informe um WhatsApp com DDD válido, como (44) 99999-9999.');const branding={...app.settings.branding,appName:values.appName,supportWhatsapp:support};const {error}=await api.from('app_settings').upsert({key:'branding',value:branding});if(error)throw error;}clearFilterDraftUrl();app.modal=null;await loadData();toast('Alterações salvas com sucesso.');}catch(error){toast(errorMessage(error))}finally{if(button?.isConnected)button.disabled=false;}}
async function mediaUrl(filter){if(app.images.has(filter.id))return app.images.get(filter.id);const {data,error}=await api.storage.from('company-filters').download(filter.storage_path);if(error)throw error;const uri=URL.createObjectURL(data);app.images.set(filter.id,uri);return uri;}
async function hydrateImages(){const imgs=document.querySelectorAll('[data-img]');for(const element of imgs){const filter=app.filters.find(f=>f.id===element.dataset.img);if(!filter)continue;mediaUrl(filter).then(url=>{if(element.isConnected&&element.dataset.img===filter.id)element.src=url}).catch(()=>{if(element.isConnected)element.alt='PNG indisponível';});}}
async function startCamera(facing='environment'){
  const video=$('cameraVideo');
  if(!video||app.galleryPhoto)return;
  stopCamera();
  const requestId=app.cameraRequestId;
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1080}}});
    // Ao escolher uma foto da galeria ou sair da tela, descartar solicitações de câmera pendentes.
    if(requestId!==app.cameraRequestId||!video.isConnected||app.galleryPhoto||app.page!=='camera'){
      stream.getTracks().forEach(t=>t.stop());
      return;
    }
    app.stream=stream;video.srcObject=stream;await video.play();app.facing=facing;
  }catch(error){
    if(requestId===app.cameraRequestId&&app.page==='camera'&&!app.galleryPhoto)
      toast('Autorize a câmera no Safari ou Chrome. '+errorMessage(error));
  }
}
function selectFilter(fid){
  app.selectedFilter=fid;
  document.querySelectorAll('.client-filter-choice').forEach(b=>{
    const selected=b.dataset.id===fid;
    b.classList.toggle('active',selected);
    b.setAttribute('aria-pressed',String(selected));
  });
  const img=$('cameraOverlay');
  const filter=app.filters.find(f=>f.id===fid);
  if(!filter||!img)return;
  img.classList.add('hidden');
  img.removeAttribute('src');
  mediaUrl(filter).then(url=>{
    if(!img.isConnected||app.selectedFilter!==fid)return;
    img.src=url;
    img.classList.remove('hidden');
  }).catch(error=>toast('Não foi possível carregar o filtro: '+errorMessage(error)));
}


function drawSourceCover(ctx,source,width,height){
  const sw=source.videoWidth||source.naturalWidth;
  const sh=source.videoHeight||source.naturalHeight;
  if(!sw||!sh)throw new Error('Não foi possível ler as dimensões da imagem.');
  // Equivalent to object-fit: cover; object-position: center, for all orientations.
  const scale=Math.max(width/sw,height/sh);
  const cropW=width/scale,cropH=height/scale;
  const sx=(sw-cropW)/2,sy=(sh-cropH)/2;
  ctx.drawImage(source,sx,sy,cropW,cropH,0,0,width,height);
}
async function loadGalleryPhoto(file){
  if(!file)return;
  if(app.processing)return toast('Aguarde a geração da imagem anterior.');
  if(!(typeof file.type==='string'&&file.type.startsWith('image/'))&&!/\.(?:jpe?g|png|webp|heic|heif)$/i.test(file.name||''))
    return toast('Escolha uma foto válida da galeria.');
  if(file.size>25*1024*1024)return toast('A foto deve ter até 25 MB.');
  const uri=URL.createObjectURL(file);
  const img=new Image();
  try{
    await new Promise((resolve,reject)=>{
      img.onload=resolve;
      img.onerror=()=>reject(new Error('Não foi possível abrir esta foto. Tente JPEG ou PNG.'));
      img.src=uri;
    });
    if(!img.naturalWidth||!img.naturalHeight)throw new Error('A imagem selecionada está vazia.');
    if(app.page!=='camera'||!app.user){URL.revokeObjectURL(uri);return;}
    stopCamera();
    clearGalleryPhoto();
    app.galleryPhoto={url:uri,img,file};
    render();
    window.scrollTo(0,0);
    toast('Foto carregada! Troque o filtro se quiser e toque em Salvar ou compartilhar.');
  }catch(error){
    URL.revokeObjectURL(uri);
    toast(errorMessage(error));
  }
}
async function capture(){
  if(app.processing)return;
  const gallery=app.galleryPhoto;
  const video=$('cameraVideo');
  if(!app.selectedFilter)return toast('Selecione um filtro.');
  if(!gallery&&(!video||!video.videoWidth||!app.stream))
    return toast('Ative a câmera ou escolha uma foto da galeria.');
  const filter=app.filters.find(f=>f.id===app.selectedFilter);
  if(!filter)return;
  app.processing=true;
  const shutter=document.querySelector('[data-act="capture"]');
  const finishButton=document.querySelector('[data-act="finish-gallery"]');
  if(shutter)shutter.disabled=true;
  if(finishButton){
    finishButton.disabled=true;
    finishButton.setAttribute('aria-busy','true');
    const title=finishButton.querySelector('strong');
    if(title)title.textContent='Preparando sua foto...';
  }
  try{
    const src=await mediaUrl(filter);
    const overlay=new Image();
    overlay.src=src;
    await new Promise((resolve,reject)=>{
      if(overlay.complete&&overlay.naturalWidth>0){resolve();return;}
      overlay.onload=resolve;overlay.onerror=()=>reject(new Error('Não foi possível aplicar o PNG ao resultado.'));
    });
    const source=gallery?gallery.img:video;
    if(!gallery&&(!video.videoWidth||!app.stream))throw new Error('A câmera parou. Ative-a novamente.');
    if(gallery&&!gallery.img.naturalWidth)throw new Error('Reabra a foto da galeria.');
    const canvas=document.createElement('canvas');
    canvas.width=1080;canvas.height=1920;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Não foi possível preparar a fotografia.');
    drawSourceCover(ctx,source,1080,1920);
    ctx.drawImage(overlay,0,0,1080,1920);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível gerar a foto.')),'image/png'));
    const name='filtros-studio-'+Date.now()+'.png';
    clearCapturedPhoto();
    app.captureData={blob,file:new File([blob],name,{type:'image/png'}),url:URL.createObjectURL(blob),name};
    stopCamera();
    app.page='preview';
    render();
    window.scrollTo(0,0);
  }catch(error){toast(errorMessage(error));}
  finally{
    app.processing=false;
    if(shutter?.isConnected)shutter.disabled=false;
    if(finishButton?.isConnected){
      finishButton.disabled=false;
      finishButton.removeAttribute('aria-busy');
      const title=finishButton.querySelector('strong');
      if(title)title.textContent='Salvar ou compartilhar';
    }
  }
}

function shareCapturedPhoto(target='general'){
  const photo=app.captureData;
  if(!photo){toast('Fotografe primeiro para compartilhar.');return;}
  const file=photo.file;
  if(typeof navigator.share!=='function'||(typeof navigator.canShare==='function'&&!navigator.canShare({files:[file]}))){
    toast('O compartilhamento de imagens não está disponível aqui. Use Salvar no celular e abra a imagem no aplicativo desejado.');
    return;
  }
  if(target==='whatsapp')toast('Na lista de aplicativos, escolha WhatsApp para enviar a foto.');
  if(target==='instagram')toast('Na lista de aplicativos, escolha Instagram e, se disponível, Stories.');
  if(target==='save')toast('No iPhone, escolha Salvar Imagem ou Salvar em Arquivos.');
  // Must be invoked directly from the button's user gesture; do not await before navigator.share.
  navigator.share({files:[file],title:'Foto com filtro'})
    .catch(error=>{
      if(error?.name!=='AbortError')toast('Não foi possível compartilhar. Tente Salvar no celular.');
    });
}
function downloadCapturedPhoto(){
  const photo=app.captureData;
  if(!photo){toast('Fotografe primeiro para salvar.');return;}
  const a=document.createElement('a');
  a.href=photo.url;a.download=photo.name;
  document.body.appendChild(a);a.click();a.remove();
  toast('Download solicitado. Confira Arquivos ou Downloads no celular.');
}
function saveCapturedPhoto(){
  const isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const canShareFile=app.captureData && typeof navigator.share==='function' &&
    (typeof navigator.canShare!=='function'||navigator.canShare({files:[app.captureData.file]}));
  if(isIOS&&canShareFile)shareCapturedPhoto('save');
  else downloadCapturedPhoto();
}

async function logoutCurrentBrowser(){
  if(logoutPending)return;
  logoutPending=true;
  // Primeiro encerra o acesso visual e remove o token persistido, sem
  // depender de uma resposta de rede para respeitar o clique em "Sair".
  setExplicitLogout(true);
  clearStoredAuthSession();
  app.adminTest.active=false;
  stopCamera();clearCapturedPhoto();clearGalleryPhoto();
  app.images.forEach(url=>URL.revokeObjectURL(url));app.images.clear();
  app.user=null;app.profile=null;app.company=null;
  app.companies=[];app.categories=[];app.filters=[];app.invoices=[];
  app.settings={};app.modal=null;app.selectedCategory=null;app.selectedFilter=null;
  app.page='dashboard';
  render();
  try {
    // 'local' encerra este navegador, sem desconectar outros dispositivos.
    const {error}=await api.auth.signOut({scope:'local'});
    if(error)console.warn('A sessão foi removida do aparelho, mas a revogação remota falhou.');
  } catch (_) {
    // Logout local permanece obrigatório mesmo sem conexão.
  } finally {
    clearStoredAuthSession();
    logoutPending=false;
  }
}
function toggleAdminSensitive(){
  if(app.profile?.role!=='admin')return;
  app.adminSensitiveHidden=!app.adminSensitiveHidden;
  try{localStorage.setItem('fs-admin-sensitive-hidden',app.adminSensitiveHidden?'1':'0');}catch(_){}
  const adminRoot=document.getElementById('adminLayout');
  if(!adminRoot)return;
  adminRoot.classList.toggle('admin-sensitive-hidden',app.adminSensitiveHidden);
  const control=adminRoot.querySelector('.admin-privacy-toggle');
  if(control){
    control.setAttribute('aria-pressed',String(app.adminSensitiveHidden));
    control.setAttribute('aria-label',app.adminSensitiveHidden?'Mostrar números do painel':'Desfocar números do painel');
    control.title=app.adminSensitiveHidden?'Mostrar números':'Desfocar números';
  }
}
async function click(event){const target=event.target.closest('[data-act],[data-nav]');if(!target)return;if(target.dataset.nav){navigate(target.dataset.nav);return;}const act=target.dataset.act,uid=target.dataset.id;try{if(act==='toggle-admin-sensitive'){toggleAdminSensitive();return;}if(act==='check-client-access'){
  if(app.profile?.role==='admin')return;
  await loadData();
  if(app.company?.access_paused||app.company?.active===false)toast('O acesso ainda está pausado. Entre em contato com o suporte.');
  else if(app.company)toast('Acesso liberado! Você já pode utilizar os filtros.');
  return;
}if(act==='open-mobile-menu'){setAdminMobileMenu(true);return;}if(act==='close-mobile-menu'){setAdminMobileMenu(false);return;}if(act==='start-admin-test'){
  if(app.profile?.role!=='admin')return;
  const co=app.companies.find(c=>c.id===app.adminTest.companyId);
  const ca=app.categories.find(c=>c.id===app.adminTest.categoryId&&c.company_id===co?.id);
  if(!co||!ca)return toast('Selecione uma empresa e categoria válidas.');
  app.adminTest.active=true;
  resetCameraSession(ca.id);
  return;
}if(act==='exit-admin-test'){exitAdminTest();return;}
if(act==='open-client-menu'){setClientCameraMenu(true);return;}if(act==='close-client-menu'){setClientCameraMenu(false);return;}if(act==='client-switch-category'){
  const next=app.categories.find(c=>c.id===uid);
  if(!next||(app.adminTest.active&&next.company_id!==app.adminTest.companyId))return;
  if(app.selectedCategory===uid){setClientCameraMenu(false);return;}
  resetCameraSession(uid);return;
}if(act==='logout'){await logoutCurrentBrowser();return;}if(act==='toggle-client-access'){
  if(app.profile?.role!=='admin')return;
  const company=app.companies.find(c=>c.id===uid);
  if(!company)return;
  const pause=!company.access_paused;
  if(pause&&!confirm('Pausar o acesso de '+company.name+'? O cliente verá uma mensagem para entrar em contato com o suporte, e seus filtros ficarão bloqueados até a reativação.'))return;
  const {error}=await api.from('companies').update({access_paused:pause}).eq('id',uid);
  if(error)throw error;
  await loadData();
  toast(pause?'Acesso pausado. Os dados e pagamentos foram preservados.':'Acesso reativado com sucesso.');
  return;
}if(act==='category-move-up'||act==='category-move-down'){
  await moveCategoryByButton(uid,act==='category-move-up'?-1:1);return;
}if(act==='close-modal'){closeModal();return;}if(act==='add-client'||act==='edit-client'){companyModal(act==='edit-client'?uid:null);return;}if(act==='add-category'||act==='edit-category'){categoryModal(act==='edit-category'?uid:null);return;}if(act==='add-invoice'||act==='edit-invoice'){invoiceModal(act==='edit-invoice'?uid:null);return;}if(act==='add-filter'){filterModal();return;}if(act==='view-filter'){editFilterModal(uid);return;}if(act==='toggle-filter-preview-bg'){
  const preview=$('filterEditorPreview');if(!preview)return;
  const dark=preview.classList.toggle('is-dark');
  target.setAttribute('aria-pressed',String(dark));
  target.textContent=dark?'◐ Ver em fundo quadriculado':'◐ Ver em fundo escuro';
  return;
}if(act==='reset-password'){openModal('Alterar senha do cliente',`<form class="form" id="passwordForm">${field('password','Nova senha (mínimo 8 caracteres)','','password',true,8)}${endForm}</form>`,'passwordForm');app.modal.recordId=uid;render();return;}if(act==='remove-client'){if(confirm('Excluir a empresa, seu login, categorias e PNGs? Esta ação é irreversível.')){await manager({action:'delete',company_id:uid});await refresh();}return;}if(act==='remove-category'){if(confirm('Excluir esta categoria? Os filtros vinculados também serão excluídos.')){
  const paths=app.filters.filter(f=>f.category_id===uid).map(f=>f.storage_path).filter(Boolean);
  const {error}=await api.from('categories').delete().eq('id',uid);
  if(error)throw error;
  if(paths.length){const {error:storageError}=await api.storage.from('company-filters').remove(paths);
    if(storageError)toast('Categoria removida, mas alguns PNGs precisam de limpeza no armazenamento.');
  }
  await refresh();
}return;}if(act==='remove-filter'){
  if(!confirm('Excluir este filtro permanentemente? O arquivo PNG também será removido.'))return;
  const filter=app.filters.find(f=>f.id===uid);
  if(!filter)return;
  const {error}=await api.from('filters').delete().eq('id',uid);
  if(error)throw error;
  if(app.images.has(uid)){URL.revokeObjectURL(app.images.get(uid));app.images.delete(uid);}
  if(app.modal?.formId==='editFilterForm')closeModal();
  const removed=await api.storage.from('company-filters').remove([filter.storage_path]);
  if(removed.error)toast('Filtro excluído, mas o PNG antigo precisa de limpeza no Storage.');
  await loadData();
  return;
}if(act==='remove-invoice'){if(confirm('Excluir esta cobrança?')){const {error}=await api.from('invoices').delete().eq('id',uid);if(error)throw error;await refresh();}return;}if(act==='toggle-paid'){const invoice=app.invoices.find(i=>i.id===uid);const paid=invoice.status!=='paid';const {error}=await api.from('invoices').update({status:paid?'paid':'pending',paid_at:paid?new Date().toISOString():null}).eq('id',uid);if(error)throw error;await refresh();return;}if(act==='open-category'){if(app.categories.some(c=>c.id===uid))resetCameraSession(uid);return;}if(act==='back-categories'){navigate('categories');return;}if(act==='choose-filter'){
  const f=app.filters.find(x=>x.id===uid);
  if(!f||f.category_id!==app.selectedCategory||
     (app.adminTest.active&&f.company_id!==app.adminTest.companyId))return;
  selectFilter(uid);return;
}if(act==='activate-camera'){await startCamera();return;}if(act==='flip-camera'){await startCamera(app.facing==='user'?'environment':'user');return;}if(act==='use-camera'){resetCameraSession();return;}if(act==='pick-gallery'){$('galleryPhotoInput')?.click();return;}if(act==='capture'||act==='finish-gallery'){capture();return;}if(act==='photo-share'){shareCapturedPhoto();return;}if(act==='photo-instagram'){shareCapturedPhoto('instagram');return;}if(act==='photo-whatsapp'){shareCapturedPhoto('whatsapp');return;}if(act==='photo-save'){saveCapturedPhoto();return;}if(act==='photo-back'||act==='photo-retake'||act==='photo-change-filter'){backToCamera();return;}}catch(error){toast(errorMessage(error));}}
function setClientCameraMenu(open){
  const root=document.querySelector('.client-app.is-camera');
  const drawer=$('clientCameraDrawer');
  if(!root||!drawer)return;
  root.classList.toggle('client-camera-menu-open',open);
  drawer.inert=!open;
  drawer.setAttribute('aria-hidden',String(!open));
  const toggle=document.querySelector('.client-camera-menu-toggle');
  toggle?.setAttribute('aria-expanded',String(open));
  document.body.classList.toggle('client-camera-menu-lock',open);
  if(open)drawer.querySelector('.client-camera-drawer-close')?.focus();
  else toggle?.focus();
}
function setAdminMobileMenu(open){
  const layout=$('adminLayout'),button=document.querySelector('.mobile-menu-toggle');
  if(!layout)return;
  layout.classList.toggle('admin-menu-open',open);
  button?.setAttribute('aria-expanded',String(open));
  document.body.classList.toggle('mobile-menu-lock',open&&window.matchMedia('(max-width:700px)').matches);
  if(open)document.querySelector('.sidebar-close')?.focus();
  else if(!document.querySelector('.overlay'))button?.focus();
}
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&$('adminLayout')?.classList.contains('admin-menu-open'))setAdminMobileMenu(false);
  if(event.key==='Escape'&&app.modal?.formId==='editFilterForm')closeModal();
  if(event.key==='Escape'&&document.querySelector('.client-camera-menu-open'))setClientCameraMenu(false);
});
window.addEventListener('resize',()=>{
  if(window.innerWidth>700&&$('adminLayout')?.classList.contains('admin-menu-open'))setAdminMobileMenu(false);
});

$('root').addEventListener('click',click);
$('root').addEventListener('pointerdown',categoryOrderPointerDown);
document.addEventListener('pointermove',categoryOrderPointerMove,{passive:false});
document.addEventListener('pointerup',event=>{void categoryOrderPointerEnd(event);});
document.addEventListener('pointercancel',event=>{void categoryOrderPointerEnd(event,true);});

$('root').addEventListener('submit',handleForm);
$('root').addEventListener('change',event=>{
  if(event.target.id==='filterLibraryCompany'&&app.profile?.role==='admin'&&app.page==='filters'){
    app.filterLibraryCompanyId=event.target.value;
    app.filterLibraryCategoryId='';
    render();return;
  }
  if(event.target.id==='filterLibraryCategory'&&app.profile?.role==='admin'&&app.page==='filters'){
    app.filterLibraryCategoryId=event.target.value;
    render();return;
  }
  if(event.target.id==='categoryOrderCompany'&&app.profile?.role==='admin'&&app.page==='filters'){
    app.categoryOrderCompanyId=event.target.value;
    render();return;
  }

  if(app.profile?.role==='admin'&&app.page==='test-filters'){
    if(event.target.id==='testCompanySelect'){
      app.adminTest.companyId=event.target.value;
      app.adminTest.categoryId=null;
      render();return;
    }
    if(event.target.id==='testCategorySelect'){
      app.adminTest.categoryId=event.target.value;
      render();return;
    }
  }
if(app.modal?.formId==='filterForm'){if(event.target.id==='f_company_id')updateCategoryOptions();if(event.target.id==='filterCategory')updateNewCategoryField();}if(event.target.id==='editFilterFile'){
  previewReplacementFilter(event.target.files?.[0]||null);return;
}
if(event.target.id==='galleryPhotoInput'){const file=event.target.files?.[0];event.target.value='';if(file)loadGalleryPhoto(file);}});
init();
