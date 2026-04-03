var SUPABASE_URL = 'https://zmzwoxaktglefycfzrpx.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptendveGFrdGdsZWZ5Y2Z6cnB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMzc4MjMsImV4cCI6MjA5MDcxMzgyM30.qQ0QKh8M_GHMN-VFchHP0kaDWZrG-0IvI-gfeepdmk0';
var BUCKET = 'documents';
var sb = null;
var currentUser = null;
var currentRole = 'auditeur';
var appData = { demandes: [], clients: [] };
var isSignup = false;
var currentDemande = null;
var cdCurrentDemande = null;
var cdSelectedFiles = [];

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

function detectRole(email) {
  var meta = currentUser && currentUser.user_metadata && currentUser.user_metadata.role;
  if (meta) return meta;
  var auditeurDomains = ['fidaexpert.ci', 'fidaexpert.com'];
  var domain = (email || '').split('@')[1] || '';
  for (var i = 0; i < auditeurDomains.length; i++) {
    if (domain === auditeurDomains[i]) return 'auditeur';
  }
  return 'client';
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
    currentRole = detectRole(currentUser.email);
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

function loadData() {
  loadSupabase().then(function() {
    return sb.from('clients').select('*').order('id', { ascending: true });
  }).then(function(cliResult) {
    if (!cliResult.error && cliResult.data) {
      appData.clients = cliResult.data.map(function(c) {
        return { id: c.id, nom: c.nom, societe: c.societe || '', email: c.email_client || '', statut: c.statut || 'Actif' };
      });
    }
    return sb.from('demandes').select('*').order('id', { ascending: false });
  }).then(function(demResult) {
    if (!demResult.error && demResult.data) {
      var allDem = demResult.data.map(function(d) {
        var cli = appData.clients.find(function(c) { return c.id === d.client_id; });
        return {
          id: 'DEM-' + String(d.id).padStart(4, '0'),
          _supabase_id: d.id,
          nom: d.nom || '—',
          client: cli ? cli.nom : (d.client || '—'),
          societe: cli ? cli.societe : (d.societe || ''),
          email_client: cli ? cli.email : '',
          description: d.description || '',
          datelimite: d.datelimite,
          statut: d.statut || 'En attente',
          priorite: d.priorite || 'Normale',
          client_id: d.client_id
        };
      });
      if (currentRole === 'client') {
        appData.demandes = allDem.filter(function(d) { return d.email_client === currentUser.email; });
      } else {
        appData.demandes = allDem;
      }
    }
    renderAll();
  }).catch(function(e) { console.error('Erreur:', e); showToast('Erreur de chargement.'); });
}

function submitNewRequest() {
  var nom = document.getElementById('n-nom').value.trim();
  var clientId = document.getElementById('n-client-id').value;
  var date = document.getElementById('n-date').value;
  var desc = document.getElementById('n-desc').value.trim();
  var priorite = document.getElementById('n-priorite').value;
  if (!nom || !clientId || !date) { showToast('Remplissez tous les champs obligatoires.'); return; }
  var btn = document.getElementById('btn-submit-request');
  btn.disabled = true; btn.textContent = 'Enregistrement...';
  loadSupabase().then(function() {
    return sb.from('demandes').insert([{ nom: nom, client_id: parseInt(clientId), description: desc, datelimite: date, statut: 'En attente', priorite: priorite }]);
  }).then(function(result) {
    if (result.error) { showToast('Erreur : ' + result.error.message); btn.disabled = false; btn.textContent = 'Créer la demande'; return; }
    showToast('Demande créée !');
    closeModal('modal-new-request');
    btn.disabled = false; btn.textContent = 'Créer la demande';
    document.getElementById('n-nom').value = '';
    document.getElementById('n-client-id').value = '';
    document.getElementById('n-date').value = '';
    document.getElementById('n-desc').value = '';
    loadData();
  }).catch(function() { showToast('Erreur.'); btn.disabled = false; btn.textContent = 'Créer la demande'; });
}

function submitNewClient() {
  var nom = document.getElementById('nc-nom').value.trim();
  var societe = document.getElementById('nc-societe').value.trim();
  var email = document.getElementById('nc-email').value.trim();
  var statut = document.getElementById('nc-statut').value;
  if (!nom || !email) { showToast('Remplissez les champs obligatoires.'); return; }
  var btn = document.getElementById('btn-submit-client');
  btn.disabled = true; btn.textContent = 'Enregistrement...';
  loadSupabase().then(function() {
    return sb.from('clients').insert([{ nom: nom, societe: societe, email_client: email, statut: statut }]);
  }).then(function(result) {
    if (result.error) { showToast('Erreur : ' + result.error.message); btn.disabled = false; btn.textContent = 'Créer le client'; return; }
    showToast('Client créé !');
    closeModal('modal-new-client');
    btn.disabled = false; btn.textContent = 'Créer le client';
    document.getElementById('nc-nom').value = '';
    document.getElementById('nc-societe').value = '';
    document.getElementById('nc-email').value = '';
    loadData();
  }).catch(function() { showToast('Erreur.'); btn.disabled = false; btn.textContent = 'Créer le client'; });
}

function populateClientSelect() {
  var select = document.getElementById('n-client-id');
  select.innerHTML = '<option value="">Sélectionner un client...</option>';
  appData.clients.forEach(function(c) {
    select.innerHTML += '<option value="' + c.id + '">' + c.nom + (c.societe ? ' — ' + c.societe : '') + '</option>';
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
    document.getElementById('cli-sub').textContent = cli.length + ' client(s) — Fidaexpert';
    document.getElementById('dash-table').innerHTML = dem.slice(0, 5).map(function(x) {
      return '<tr onclick="openDetail(\'' + x.id + '\')" style="cursor:pointer;"><td><div class="td-primary">' + x.nom + '</div><div class="td-mono">' + x.id + '</div></td><td>' + x.client + '</td><td>' + badgeHTML(x.statut) + '</td><td>' + prioHTML(x.priorite) + '</td><td style="' + (x.statut === 'En retard' ? 'color:var(--red);font-weight:500;' : '') + '">' + fmtDate(x.datelimite) + '</td></tr>';
    }).join('');
    renderReqTable(dem);
    document.getElementById('cli-table').innerHTML = cli.length === 0
      ? '<tr><td colspan="6" style="text-align:center;padding:28px;color:var(--text-muted);font-size:13px;">Aucun client.</td></tr>'
      : cli.map(function(c) {
          var init = c.nom.split(' ').map(function(n) { return n[0]; }).join('').substring(0, 2).toUpperCase();
          var dCli = dem.filter(function(x) { return x.client_id === c.id; });
          var ret = dCli.filter(function(x) { return x.statut === 'En retard'; }).length;
          return '<tr><td><div style="display:flex;align-items:center;gap:10px;"><div style="width:28px;height:28px;border-radius:6px;background:var(--bg);border:0.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:500;color:var(--text-secondary);">' + init + '</div><div class="td-primary">' + c.nom + '</div></div></td><td>' + c.societe + '</td><td style="font-size:12px;">' + c.email + '</td><td>' + (c.statut === 'Actif' ? '<span class="badge badge-green">Actif</span>' : '<span class="badge badge-gray">Inactif</span>') + '</td><td style="font-family:var(--mono);font-size:13px;font-weight:500;">' + dCli.length + '</td><td style="font-family:var(--mono);font-size:13px;font-weight:500;color:' + (ret > 0 ? 'var(--red)' : 'var(--text-muted)') + ';">' + ret + '</td></tr>';
        }).join('');
  } else {
    document.getElementById('client-table').innerHTML = dem.length === 0
      ? '<tr><td colspan="5" style="text-align:center;padding:28px;color:var(--text-muted);font-size:13px;">Aucune demande pour le moment.</td></tr>'
      : dem.map(function(x) {
          return '<tr onclick="openClientDetail(\'' + x.id + '\')" style="cursor:pointer;"><td><div class="td-primary">' + x.nom + '</div><div class="td-mono">' + x.id + '</div></td><td>' + (x.societe || x.client) + '</td><td>' + badgeHTML(x.statut) + '</td><td>' + prioHTML(x.priorite) + '</td><td style="' + (x.statut === 'En retard' ? 'color:var(--red);font-weight:500;' : '') + '">' + fmtDate(x.datelimite) + '</td></tr>';
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
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:28px;color:var(--text-muted);font-size:13px;">Aucun document déposé.</td></tr>';
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
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:28px;color:var(--text-muted);">Erreur.</td></tr>';
  });
}

function deleteDemande() {
  if (!currentDemande) return;
  if (!confirm('Supprimer "' + currentDemande.nom + '" ? Cette action est irréversible.')) return;
  loadSupabase().then(function() {
    return sb.from('demandes').delete().eq('id', currentDemande._supabase_id);
  }).then(function(result) {
    if (result.error) { showToast('Erreur : ' + result.error.message); return; }
    showToast('Demande supprimée.');
    showPage('requests');
    currentDemande = null;
    loadData();
  }).catch(function() { showToast('Erreur de suppression.'); });
}

function openClientDetail(id) {
  var dem = appData.demandes || [];
  cdCurrentDemande = dem.find(function(d) { return d.id === id; });
  if (!cdCurrentDemande) return;
  document.getElementById('cd-nom').textContent = cdCurrentDemande.nom;
  document.getElementById('cd-id').textContent = cdCurrentDemande.id;
  document.getElementById('cd-date').textContent = fmtDate(cdCurrentDemande.datelimite);
  document.getElementById('cd-prio').innerHTML = prioHTML(cdCurrentDemande.priorite);
  document.getElementById('cd-desc').textContent = cdCurrentDemande.description || 'Aucune description.';
  document.getElementById('cd-badge').innerHTML = badgeHTML(cdCurrentDemande.statut);
  cdClearFiles();
  showPage('client-detail');
  cdReloadDocs();
}

function cdHandleDragOver(e) { e.preventDefault(); document.getElementById('cd-upload-zone').style.borderColor = 'var(--text-primary)'; }
function cdHandleDragLeave() { document.getElementById('cd-upload-zone').style.borderColor = 'var(--border)'; }
function cdHandleDrop(e) { e.preventDefault(); document.getElementById('cd-upload-zone').style.borderColor = 'var(--border)'; cdAddFiles(e.dataTransfer.files); }
function cdHandleFileSelect(e) { cdAddFiles(e.target.files); }

function cdAddFiles(files) {
  Array.from(files).forEach(function(f) {
    if (f.size > 50 * 1024 * 1024) { showToast(f.name + ' dépasse 50 Mo.'); return; }
    if (!cdSelectedFiles.find(function(x) { return x.name === f.name; })) cdSelectedFiles.push(f);
  });
  cdRenderFileList();
}

function cdRenderFileList() {
  var list = document.getElementById('cd-file-list');
  var items = document.getElementById('cd-file-items');
  if (cdSelectedFiles.length === 0) { list.style.display = 'none'; return; }
  list.style.display = 'block';
  items.innerHTML = cdSelectedFiles.map(function(f, i) {
    var ext = f.name.split('.').pop().toLowerCase();
    var colors = extStyle(ext);
    var size = f.size < 1048576 ? Math.round(f.size / 1024) + ' Ko' : (f.size / 1048576).toFixed(1) + ' Mo';
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg);border-radius:var(--radius);border:0.5px solid var(--border);margin-bottom:6px;"><div style="width:28px;height:28px;border-radius:5px;background:' + colors[0] + ';color:' + colors[1] + ';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;">' + ext.toUpperCase().substring(0,4) + '</div><div style="flex:1;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + f.name + '</div><div style="font-size:11px;color:var(--text-muted);white-space:nowrap;">' + size + '</div><button onclick="cdRemoveFile(' + i + ')" style="width:22px;height:22px;border:0.5px solid var(--border);background:#fff;border-radius:4px;cursor:pointer;font-size:11px;color:var(--text-muted);">✕</button></div>';
  }).join('');
}

function cdRemoveFile(i) { cdSelectedFiles.splice(i, 1); cdRenderFileList(); }
function cdClearFiles() { cdSelectedFiles = []; cdRenderFileList(); var inp = document.getElementById('cd-file-input'); if (inp) inp.value = ''; }

function cdUploadFiles() {
  if (!cdCurrentDemande) { showToast('Aucune demande sélectionnée.'); return; }
  if (cdSelectedFiles.length === 0) { showToast('Ajoutez au moins un fichier.'); return; }
  var btn = document.getElementById('cd-btn-upload');
  var progress = document.getElementById('cd-progress');
  var progressFill = document.getElementById('cd-progress-fill');
  var progressText = document.getElementById('cd-progress-text');
  btn.disabled = true; progress.style.display = 'block';
  var uploaded = 0; var total = cdSelectedFiles.length;
  function uploadNext(index) {
    if (index >= total) {
      progressFill.style.width = '100%';
      progressText.textContent = uploaded + ' fichier(s) déposé(s) !';
      showToast(uploaded + ' fichier(s) déposé(s) avec succès !');
      btn.disabled = false; cdSelectedFiles = []; cdRenderFileList();
      document.getElementById('cd-file-input').value = '';
      cdReloadDocs();
      setTimeout(function() { progress.style.display = 'none'; progressFill.style.width = '0%'; }, 3000);
      return;
    }
    var file = cdSelectedFiles[index];
    progressText.textContent = 'Upload de ' + file.name + '...';
    progressFill.style.width = Math.round((index / total) * 100) + '%';
    var path = cdCurrentDemande.id + '/' + Date.now() + '_' + file.name;
    loadSupabase().then(function() {
      return sb.storage.from(BUCKET).upload(path, file, { upsert: true });
    }).then(function(result) {
      if (!result.error) uploaded++;
      uploadNext(index + 1);
    });
  }
  uploadNext(0);
}

function cdReloadDocs() {
  if (!cdCurrentDemande) return;
  var tbody = document.getElementById('cd-docs-table');
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:28px;"><div class="loading-spinner" style="margin:0 auto;"></div></td></tr>';
  loadSupabase().then(function() {
    return sb.storage.from(BUCKET).list(cdCurrentDemande.id, { limit: 50 });
  }).then(function(result) {
    if (result.error || !result.data || result.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:28px;color:var(--text-muted);font-size:13px;">Aucun document déposé.</td></tr>';
      return;
    }
    tbody.innerHTML = result.data.map(function(f) {
      var ext = f.name.split('.').pop().toLowerCase();
      var colors = extStyle(ext);
      var url = SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + cdCurrentDemande.id + '/' + f.name;
      var date = f.created_at ? new Date(f.created_at).toLocaleDateString('fr-FR') : '—';
      var cleanName = f.name.replace(/^\d+_/, '');
      return '<tr><td><div style="display:flex;align-items:center;gap:8px;"><div style="width:28px;height:28px;border-radius:5px;background:' + colors[0] + ';color:' + colors[1] + ';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;">' + ext.toUpperCase().substring(0,4) + '</div><span style="font-size:13px;font-weight:500;">' + cleanName + '</span></div></td><td style="font-size:12px;color:var(--text-muted);">' + date + '</td><td><a href="' + url + '" target="_blank" style="padding:3px 9px;background:var(--bg);border:0.5px solid var(--border);border-radius:var(--radius);font-size:11px;color:var(--text-primary);text-decoration:none;">Télécharger</a></td></tr>';
    }).join('');
  }).catch(function() {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:28px;color:var(--text-muted);">Erreur.</td></tr>';
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
    table.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:28px;color:var(--text-muted);">Erreur.</td></tr>';
  });
}

var pagesMeta = {
  'dashboard': { title: 'Vue d\'ensemble', sub: 'Mission Exercice 2024 — Fidaexpert' },
  'requests': { title: 'Demandes', sub: '' },
  'clients': { title: 'Clients', sub: '' },
  'documents': { title: 'Documents reçus', sub: 'Fichiers déposés par les clients' },
  'detail': { title: 'Détail de la demande', sub: 'Documents déposés' },
  'client-dashboard': { title: 'Mes demandes', sub: 'Documents à fournir à Fidaexpert' },
  'client-detail': { title: 'Détail de la demande', sub: 'Déposer vos documents' }
};

function showPage(id) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  var page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  var menu = currentRole === 'auditeur' ? '#menu-auditeur' : '#menu-client';
  var navMap = { dashboard: 0, requests: 1, clients: 2, documents: 3, detail: 1, 'client-dashboard': 0, 'client-detail': 0 };
  var items = document.querySelectorAll(menu + ' .nav-item');
  if (navMap[id] !== undefined && items[navMap[id]]) items[navMap[id]].classList.add('active');
  if (pagesMeta[id]) {
    document.getElementById('topbar-title').textContent = pagesMeta[id].title;
    document.getElementById('topbar-subtitle').textContent = pagesMeta[id].sub;
  }
}

function openModal(id) {
  if (id === 'modal-new-request') populateClientSelect();
  document.getElementById(id).classList.add('open');
}
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

loadSupabase().then(function() {
  return sb.auth.getSession();
}).then(function(result) {
  if (result.data && result.data.session) {
    currentUser = result.data.session.user;
    currentRole = detectRole(currentUser.email);
    showApp();
  }
}).catch(function() {});
