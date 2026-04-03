var SUPABASE_URL = 'https://zmzwoxaktglefycfzrpx.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptendveGFrdGdsZWZ5Y2Z6cnB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMzc4MjMsImV4cCI6MjA5MDcxMzgyM30.qQ0QKh8M_GHMN-VFchHP0kaDWZrG-0IvI-gfeepdmk0';
var DATA_URL = 'https://auditfloww.github.io/auditflow/data.json';
var BUCKET = 'documents';
var sb = null;
var currentUser = null;
var currentRole = 'auditeur';
var appData = { demandes: [], clients: [] };
var isSignup = false;
var currentDemande = null;

function loadSupabase() {
  return new Promise(function(resolve, reject) {
    if (sb) { resolve(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js';
    s.onload = function() { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function selectRole(r) {
  currentRole = r;
  document.getElementById('role-auditeur').classList.toggle('active', r === 'auditeur');
  document.getElementById('role-client').classList.toggle('active', r === 'client');
}

function toggleMode() {
  isSignup = !isSignup;
  document.getElementById('btn-login').style.display = isSignup ? 'none' : 'block';
  document.getElementById('btn-signup').style.display = isSignup ? 'block' : 'none';
  document.getElementById('toggle-text').textContent = isSignup ? 'Déjà un compte ? ' : 'Pas encore de compte ? ';
  document.getElementById('toggle-link').textContent = isSignup ? 'Se connecter' : 'Créer un compte';
}

function showError(msg) {
  var el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.add('show');
}

function doLogin() {
  var email = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-password').value;
  var btn = document.getElementById('btn-login');
  if (!email || !password) { showError('Remplissez tous les champs.'); return; }
  btn.disabled = true; btn.textContent = 'Connexion...';
  loadSupabase().then(function() {
    return sb.auth.signInWithPassword({ email: email, password: password });
  }).then(function(result) {
    if (result.error) { showError('Email ou mot de passe incorrect.'); btn.disabled = false; btn.textContent = 'Se connecter'; return; }
    currentUser = result.data.user;
    currentRole = (result.data.user.user_metadata && result.data.user.user_metadata.role) || currentRole;
    showApp();
  }).catch(function() { showError('Erreur de connexion.'); btn.disabled = false; btn.textContent = 'Se connecter'; });
}

function doSignup() {
  var email = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-password').value;
  var btn = document.getElementById('btn-signup');
  if (!email || !password) { showError('Remplissez tous les champs.'); return; }
  btn.disabled = true; btn.textContent = 'Création...';
  loadSupabase().then(function() {
    return sb.auth.signUp({ email: email, password: password, options: { data: { role: currentRole } } });
  }).then(function(result) {
    if (result.error) { showError(result.error.message); btn.disabled = false; btn.textContent = 'Créer mon compte'; return; }
    showToast('Compte créé ! Connectez-vous maintenant.');
    toggleMode(); btn.disabled = false; btn.textContent = 'Créer mon compte';
  });
}

function doLogout() {
  loadSupabase().then(function() { return sb.auth.signOut(); }).then(function() {
    document.getElementById('app').classList.remove('visible');
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('menu-auditeur').style.display = 'none';
    document.getElementById('menu-client').style.display = 'none';
    document.getElementById('btn-login').disabled = false;
    document.getElementById('btn-login').textContent = 'Se connecter';
    document.getElementById('login-error').classList.remove('show');
    currentUser = null;
  });
}

function showApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  var email = currentUser.email;
  document.getElementById('user-avatar').textContent = email.substring(0, 2).toUpperCase();
  document.getElementById('user-name').textContent = email;
  document.getElementById('user-role-label').textContent = currentRole === 'auditeur' ? 'Auditeur' : 'Client';
  if (currentRole === 'auditeur') {
    document.getElementById('menu-auditeur').style.display = 'block';
    document.getElementById('btn-new-request').style.display = 'flex';
    showPage('dashboard');
  } else {
    document.getElementById('menu-client').style.display = 'block';
    document.getElementById('client-hello').textContent = 'Bonjour ' + email.split('@')[0] + ' !';
    showPage('client-dashboard');
  }
  loadData();
}

// ── CHARGEMENT DES DONNÉES ──
// Essaie d'abord Supabase, fallback sur data.json
function loadData() {
  loadSupabase().then(function() {
    return sb.from('demandes').select('*').order('id', { ascending: false });
  }).then(function(result) {
    if (result.error || !result.data) { return loadDataFromJSON(); }
    if (result.data.length > 0) {
      appData.demandes = result.data.map(function(d) {
        return {
          id: 'DEM-' + String(d.id).padStart(4, '0'),
          nom: d.nom,
          client: d.client,
          societe: d.societe || '',
          description: d.description || '',
          datelimite: d.datelimite,
          statut: d.statut || 'En attente',
          priorite: d.priorite || 'Normale',
          _supabase_id: d.id
        };
      });
      return loadClientsFromJSON();
    } else {
      return loadDataFromJSON();
    }
  }).catch(function() { loadDataFromJSON(); });
}

function loadDataFromJSON() {
  return fetch(DATA_URL + '?t=' + Date.now()).then(function(r) { return r.json(); }).then(function(data) {
    appData = data; renderAll();
  }).catch(function() { showToast('Erreur de chargement.'); });
}

function loadClientsFromJSON() {
  return fetch(DATA_URL + '?t=' + Date.now()).then(function(r) { return r.json(); }).then(function(data) {
    appData.clients = data.clients || [];
    renderAll();
  }).catch(function() { renderAll(); });
}

// ── CRÉER UNE DEMANDE DIRECTEMENT ──
function submitNewRequest() {
  var nom = document.getElementById('n-nom').value.trim();
  var client = document.getElementById('n-client').value.trim();
  var date = document.getElementById('n-date').value;
  var societe = document.getElementById('n-societe').value.trim();
  var desc = document.getElementById('n-desc').value.trim();
  var priorite = document.getElementById('n-priorite').value;
  if (!nom || !client || !date) { showToast('Remplissez les champs obligatoires.'); return; }
  var btn = document.getElementById('btn-submit-request');
  btn.disabled = true; btn.textContent = 'Enregistrement...';
  loadSupabase().then(function() {
    return sb.from('demandes').insert([{
      nom: nom,
      client: client,
      societe: societe,
      description: desc,
      datelimite: date,
      statut: 'En attente',
      priorite: priorite
    }]).select();
  }).then(function(result) {
    if (result.error) {
      showToast('Erreur : ' + result.error.message);
      btn.disabled = false; btn.textContent = 'Créer la demande';
      return;
    }
    showToast('Demande créée ! Le client peut la voir immédiatement.');
    closeModal('modal-new-request');
    btn.disabled = false; btn.textContent = 'Créer la demande';
    // Vider le formulaire
    document.getElementById('n-nom').value = '';
    document.getElementById('n-client').value = '';
    document.getElementById('n-societe').value = '';
    document.getElementById('n-date').value = '';
    document.getElementById('n-desc').value = '';
    // Recharger les données
    loadData();
  }).catch(function() {
    showToast('Erreur de connexion.');
    btn.disabled = false; btn.textContent = 'Créer la demande';
  });
}

function badgeHTML(s) {
  var map = { 'En retard': 'badge-red', 'Recu': 'badge-green', 'En attente': 'badge-orange', 'Envoye': 'badge-gray' };
  return '<span class="badge ' + (map[s] || 'badge-gray') + '">' + s + '</span>';
}
function prioHTML(p) { return p === 'Haute' ? '<span class="priority-high">▲ Haute</span>' : '<span class="priority-normal">— Normale</span>'; }
function fmtDate(d) {
  if (!d) return '—';
  var parts = d.split('-');
  var mois = ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sep.','oct.','nov.','déc.'];
  return parseInt(parts[2]) + ' ' + mois[parseInt(parts[1]) - 1] + ' ' + parts[0];
}
function extStyle(ext) {
  var map = { pdf: ['#FDF0EE','#C0392B'], xlsx: ['#EEF7F2','#1E6B3C'], xls: ['#EEF7F2','#1E6B3C'], docx: ['#EEF3F8','#1A3A5C'], doc: ['#EEF3F8','#1A3A5C'] };
  return map[ext] || ['#F7F7F7','#555'];
}

function renderAll() {
  var dem = appData.demandes || [], cli = appData.clients || [];
  var retard = dem.filter(function(x) { return x.statut === 'En retard'; }).length;
  var attente = dem.filter(function(x) { return x.statut === 'En attente'; }).length;
  var taux = dem.length > 0 ? Math.round((attente / dem.length) * 100) : 0;
  if (currentRole === 'auditeur') {
    document.getElementById('s-total').textContent = dem.length;
    document.getElementById('s-attente').textContent = attente;
    document.getElementById('s-clients').textContent = cli.length;
    document.getElementById('s-retard').textContent = retard;
    document.getElementById('badge-retard').textContent = retard;
    document.getElementById('taux').textContent = taux + '%';
    document.getElementById('prog-fill').style.width = taux + '%';
    document.getElementById('prog-attente').textContent = attente;
    document.getElementById('prog-retard').textContent = retard;
    document.getElementById('req-sub').textContent = dem.length + ' demandes';
    document.getElementById('req-count').textContent = dem.length + ' résultats';
    document.getElementById('cli-sub').textContent = cli.length + ' clients — Fidaexpert';
    document.getElementById('dash-table').innerHTML = dem.slice(0, 5).map(function(x) {
      return '<tr onclick="openDetail(\'' + x.id + '\')" style="cursor:pointer;"><td><div class="td-primary">' + x.nom + '</div><div class="td-mono">' + x.id + '</div></td><td>' + x.client + '</td><td>' + badgeHTML(x.statut) + '</td><td>' + prioHTML(x.priorite) + '</td><td style="' + (x.statut === 'En retard' ? 'color:var(--red);font-weight:500;' : '') + '">' + fmtDate(x.datelimite) + '</td></tr>';
    }).join('');
    renderReqTable(dem);
    document.getElementById('cli-table').innerHTML = cli.map(function(c) {
      var init = c.nom.split(' ').map(function(n) { return n[0]; }).join('').substring(0, 2).toUpperCase();
      var dCli = dem.filter(function(x) { return x.client === c.nom; });
      var ret = dCli.filter(function(x) { return x.statut === 'En retard'; }).length;
      return '<tr><td><div style="display:flex;align-items:center;gap:10px;"><div style="width:28px;height:28px;border-radius:6px;background:var(--bg);border:0.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:500;color:var(--text-secondary);">' + init + '</div><div class="td-primary">' + c.nom + '</div></div></td><td>' + c.societe + '</td><td style="font-size:12px;">' + c.email + '</td><td>' + (c.statut === 'Actif' ? '<span class="badge badge-green">Actif</span>' : '<span class="badge badge-gray">Inactif</span>') + '</td><td style="font-family:var(--mono);font-size:13px;font-weight:500;">' + dCli.length + '</td><td style="font-family:var(--mono);font-size:13px;font-weight:500;color:' + (ret > 0 ? 'var(--red)' : 'var(--text-muted)') + ';">' + ret + '</td></tr>';
    }).join('');
  } else {
    document.getElementById('client-table').innerHTML = dem.map(function(x) {
      return '<tr><td><div class="td-primary">' + x.nom + '</div><div class="td-mono">' + x.id + '</div></td><td>' + (x.societe || x.client) + '</td><td>' + badgeHTML(x.statut) + '</td><td>' + prioHTML(x.priorite) + '</td><td style="' + (x.statut === 'En retard' ? 'color:var(--red);font-weight:500;' : '') + '">' + fmtDate(x.datelimite) + '</td></tr>';
    }).join('');
  }
}

function renderReqTable(data) {
  document.getElementById('req-table').innerHTML = data.length === 0
    ? '<tr><td colspan="6" style="text-align:center;padding:28px;color:var(--text-muted);font-size:13px;">Aucune demande.</td></tr>'
    : data.map(function(x) {
        return '<tr onclick="openDetail(\'' + x.id + '\')" style="cursor:pointer;"><td><div class="td-primary">' + x.nom + '</div><div class="td-mono">' + x.id + '</div></td><td>' + x.client + '</td><td>' + (x.societe || '—') + '</td><td>' + badgeHTML(x.statut) + '</td><td>' + prioHTML(x.priorite) + '</td><td style="' + (x.statut === 'En retard' ? 'color:var(--red);font-weight:500;' : '') + '">' + fmtDate(x.datelimite) + '</td></tr>';
      }).join('');
}

function filterReq(v) {
  var f = appData.demandes.filter(function(x) { return x.nom.toLowerCase().includes(v.toLowerCase()) || x.client.toLowerCase().includes(v.toLowerCase()); });
  renderReqTable(f);
  document.getElementById('req-count').textContent = f.length + ' résultats';
}
function filterReqStatus(v) {
  var f = v ? appData.demandes.filter(function(x) { return x.statut === v; }) : appData.demandes;
  renderReqTable(f);
  document.getElementById('req-count').textContent = f.length + ' résultats';
}

function openDetail(id) {
  var dem = appData.demandes || [];
  currentDemande = dem.find(function(d) { return d.id === id; });
  if (!currentDemande) return;
  document.getElementById('detail-nom').textContent = currentDemande.nom;
  document.getElementById('detail-id').textContent = currentDemande.id;
  document.getElementById('detail-client').textContent = currentDemande.client || '—';
  document.getElementById('detail-societe').textContent = currentDemande.societe || '—';
  document.getElementById('detail-date').textContent = fmtDate(currentDemande.datelimite);
  document.getElementById('detail-prio').innerHTML = prioHTML(currentDemande.priorite);
  document.getElementById('detail-desc').textContent = currentDemande.description || 'Aucune description.';
  document.getElementById('detail-badge').innerHTML = badgeHTML(currentDemande.statut);
  showPage('detail');
  reloadDetailDocs();
}

function reloadDetailDocs() {
  if (!currentDemande) return;
  var tbody = document.getElementById('detail-docs');
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:28px;"><div class="loading-spinner" style="margin:0 auto;"></div></td></tr>';
  loadSupabase().then(function() {
    return sb.storage.from(BUCKET).list(currentDemande.id, { limit: 50 });
  }).then(function(result) {
    if (result.error || !result.data || result.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:28px;color:var(--text-muted);font-size:13px;">Aucun document déposé pour cette demande.</td></tr>';
      return;
    }
    tbody.innerHTML = result.data.map(function(f) {
      var ext = f.name.split('.').pop().toLowerCase();
      var colors = extStyle(ext);
      var url = SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + currentDemande.id + '/' + f.name;
      var date = f.created_at ? new Date(f.created_at).toLocaleDateString('fr-FR') : '—';
      var cleanName = f.name.replace(/^\d+_/, '');
      return '<tr><td><div style="display:flex;align-items:center;gap:8px;"><div style="width:28px;height:28px;border-radius:5px;background:' + colors[0] + ';color:' + colors[1] + ';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;">' + ext.toUpperCase().substring(0,4) + '</div><div class="td-primary" style="font-size:13px;">' + cleanName + '</div></div></td><td style="font-size:12px;color:var(--text-muted);">' + date + '</td><td><a href="' + url + '" target="_blank" style="padding:3px 9px;background:var(--bg);border:0.5px solid var(--border);border-radius:var(--radius);font-size:11px;color:var(--text-primary);text-decoration:none;">Télécharger</a></td></tr>';
    }).join('');
  }).catch(function() {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:28px;color:var(--text-muted);">Erreur de chargement.</td></tr>';
  });
}

function loadDocuments() {
  var table = document.getElementById('docs-table');
  table.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:28px;"><div class="loading-spinner" style="margin:0 auto;"></div></td></tr>';
  loadSupabase().then(function() {
    return sb.storage.from(BUCKET).list('', { limit: 100 });
  }).then(function(result) {
    if (result.error || !result.data || result.data.length === 0) {
      table.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:28px;color:var(--text-muted);font-size:13px;">Aucun fichier reçu.</td></tr>';
      return;
    }
    var folders = result.data.filter(function(f) { return !f.name.includes('.'); });
    var rows = [];
    var promises = folders.map(function(folder) {
      return sb.storage.from(BUCKET).list(folder.name, { limit: 50 }).then(function(res) {
        if (res.data) {
          res.data.forEach(function(f) {
            var ext = f.name.split('.').pop().toLowerCase();
            var colors = extStyle(ext);
            var url = SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + folder.name + '/' + f.name;
            var date = f.created_at ? new Date(f.created_at).toLocaleDateString('fr-FR') : '—';
            var cleanName = f.name.replace(/^\d+_/, '');
            rows.push('<tr><td><div style="display:flex;align-items:center;gap:8px;"><div style="width:28px;height:28px;border-radius:5px;background:' + colors[0] + ';color:' + colors[1] + ';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;">' + ext.toUpperCase().substring(0,4) + '</div><div class="td-primary" style="font-size:13px;">' + cleanName + '</div></div></td><td style="font-size:12px;color:var(--text-muted);">' + folder.name + '</td><td style="font-size:12px;color:var(--text-muted);">' + date + '</td><td><a href="' + url + '" target="_blank" style="padding:3px 9px;background:var(--bg);border:0.5px solid var(--border);border-radius:var(--radius);font-size:11px;color:var(--text-primary);text-decoration:none;">Télécharger</a></td></tr>');
          });
        }
      });
    });
    return Promise.all(promises).then(function() {
      table.innerHTML = rows.length > 0 ? rows.join('') : '<tr><td colspan="4" style="text-align:center;padding:28px;color:var(--text-muted);font-size:13px;">Aucun fichier reçu.</td></tr>';
      document.getElementById('docs-sub').textContent = rows.length + ' fichier(s) reçu(s)';
    });
  }).catch(function() {
    table.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:28px;color:var(--text-muted);">Erreur de chargement.</td></tr>';
  });
}

var pagesMeta = {
  'dashboard': { title: 'Vue d\'ensemble', sub: 'Mission Exercice 2024 — Fidaexpert' },
  'requests': { title: 'Demandes', sub: '' },
  'clients': { title: 'Clients', sub: '' },
  'documents': { title: 'Documents reçus', sub: 'Fichiers déposés par les clients' },
  'detail': { title: 'Détail de la demande', sub: 'Documents déposés' },
  'client-dashboard': { title: 'Mes demandes', sub: 'Documents à fournir à Fidaexpert' }
};

function showPage(id) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  var page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  var menu = currentRole === 'auditeur' ? '#menu-auditeur' : '#menu-client';
  var navMap = { dashboard: 0, requests: 1, clients: 2, documents: 3, detail: 1, 'client-dashboard': 0 };
  var items = document.querySelectorAll(menu + ' .nav-item');
  if (navMap[id] !== undefined && items[navMap[id]]) items[navMap[id]].classList.add('active');
  if (pagesMeta[id]) {
    document.getElementById('topbar-title').textContent = pagesMeta[id].title;
    document.getElementById('topbar-subtitle').textContent = pagesMeta[id].sub;
  }
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function closeModalOnBg(e, id) { if (e.target === document.getElementById(id)) closeModal(id); }

var toastTimer;
function showToast(msg) {
  var t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { t.classList.remove('show'); }, 4000);
}

// Vérifier session existante au chargement
loadSupabase().then(function() {
  return sb.auth.getSession();
}).then(function(result) {
  if (result.data && result.data.session) {
    currentUser = result.data.session.user;
    currentRole = (result.data.session.user.user_metadata && result.data.session.user.user_metadata.role) || 'auditeur';
    showApp();
  }
}).catch(function() {});
