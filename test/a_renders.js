// ════════════════════════════════════════════════════════════════
// RENDERERS.JS — Mesin Render Bentuk Soal
// ────────────────────────────────────────────────────────────────
// Untuk MENAMBAH tipe soal baru:
//   1. Tulis fungsi render baru: function rNamaBaru(q){ ... }
//   2. Tulis fungsi submit-nya:  function subNamaBaru(...){ ... }
//   3. Daftarkan di RENDERERS di bawah
//
// Untuk MENGHAPUS tipe soal:
//   1. Hapus fungsi rendernya
//   2. Hapus baris di RENDERERS
//
// File index.html TIDAK perlu diubah sama sekali.
// ════════════════════════════════════════════════════════════════

const RENDERERS = {
  image_single:      rImgS,
  image_multi:       rImgM,
  text_choice:       rTxtC,
  text_input:        rTxtI,
  text_input_scored: rTIS,
  digit_check:       rDC,
  ab_choice:         rAB,
  // tambah tipe baru di sini ↓
  // nama_tipe:      rFungsiRender,
};


// ── [1] IMAGE SINGLE ─────────────────────────────────────────────
// Soal bergambar, pilih satu gambar jawaban
// Dipakai: APM, CFIT 1/3/4, IST 7/8
// ─────────────────────────────────────────────────────────────────
function rImgS(q) {
  const p = q.question.split(' ');
  $('questionContent').innerHTML =
    `<div class="q-label">Soal ${p[0]}${skB()}</div>
     <img class="q-image" src="${p[1]}" alt="soal" oncontextmenu="return false" ondragstart="return false">
     <div class="options-img" id="optArea"></div>`;
  $('actionBar').innerHTML =
    `<button class="btn btn-outline btn-sm" onclick="skipQ()">Lewati</button>`;
  for (const k in q.options) {
    if (!q.options[k]) continue;
    const img = Object.assign(document.createElement('img'), { src: q.options[k], title: k });
    img.setAttribute('oncontextmenu', 'return false');
    img.setAttribute('ondragstart', 'return false');
    img.onclick = () => {
      mAns(qi);
      ua.push(`${qi+1}${k}${k === q.answer ? 'v' : 'x'}`);
      if (k === q.answer) sc++;
      saveSt(); goNx();
    };
    $('optArea').appendChild(img);
  }
}


// ── [2] IMAGE MULTI ──────────────────────────────────────────────
// Soal bergambar, pilih 2 gambar sekaligus
// Dipakai: CFIT 2
// ─────────────────────────────────────────────────────────────────
function rImgM(q) {
  $('questionContent').innerHTML =
    `<div class="q-label">Pilih 2 gambar yang BERBEDA dari lainnya</div>
     <div class="options-img" id="optArea" style="gap:14px"></div>`;
  $('actionBar').innerHTML =
    `<button class="btn btn-success btn-sm" id="btnJ" onclick="subIM()" disabled>Jawab</button>
     <button class="btn btn-outline btn-sm" onclick="skipQ()">Lewati</button>`;
  q.options.forEach((src, i) => {
    const w = document.createElement('div');
    w.className = 'opt-check-wrap';
    w.innerHTML =
      `<input type="checkbox" id="mc${i}" value="${src}">
       <label for="mc${i}"><img src="${src}" oncontextmenu="return false" ondragstart="return false"></label>`;
    w.querySelector('input').addEventListener('change', () => {
      $('btnJ').disabled = document.querySelectorAll('#optArea input:checked').length !== 2;
    });
    $('optArea').appendChild(w);
  });
}

function subIM() {
  const q = qs[qi];
  const sel = [...document.querySelectorAll('#optArea input:checked')].map(c => c.value);
  const ok = sel.length === 2 && sel.every(v => q.correctAnswers.includes(v));
  mAns(qi);
  const opsiHuruf = ['a','b','c','d','e','f'];
  const huruf = sel.map(v => {
    const idx = q.options.indexOf(v);
    return idx >= 0 ? opsiHuruf[idx] : '?';
  }).sort().join('').toUpperCase();
  ua.push(`${qi+1}${huruf}${ok ? 'v' : 'x'}`);
  if (ok) sc++;
  saveSt(); goNx();
}


// ── [3] TEXT CHOICE ──────────────────────────────────────────────
// Soal teks dengan pilihan jawaban teks (A/B/C/D/E)
// Dipakai: IST 0/1/2/3/9, TKD3
// ─────────────────────────────────────────────────────────────────
function rTxtC(q) {
  let opts = '';
  for (const k in q.options) {
    if (!q.options[k]) continue;
    opts += `<button class="opt-text" onclick="subTC('${k}','${q.answer}')"><strong>${k}.</strong> ${q.options[k]}</button>`;
  }
  $('questionContent').innerHTML =
    `<div class="q-label">Soal No. ${qi+1}${skB()}</div>
     <div class="q-text">${q.question}</div>
     <div class="options-text">${opts}</div>`;
  $('actionBar').innerHTML =
    `<button class="btn btn-outline btn-sm" onclick="skipQ()">Lewati</button>`;
}

function subTC(k, ans) {
  mAns(qi);
  ua.push(`${qi+1}${k}${k === ans ? 'v' : 'x'}`);
  if (k === ans) sc++;
  saveSt(); goNx();
}


// ── [4] TEXT INPUT ───────────────────────────────────────────────
// Soal teks dengan jawaban diketik bebas
// Dipakai: TKD6
// ─────────────────────────────────────────────────────────────────
function rTxtI(q) {
  const iT = cfg.id === 'tkd6';
  const isMobile = (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && window.innerWidth <= 768;
  const npHtml = iT && isMobile
    ? `<div class="numpad-wrap">
         <div class="numpad-row">${'12345'.split('').map(d => `<button class="numpad-btn" onclick="np('${d}')">${d}</button>`).join('')}</div>
         <div class="numpad-row">${'67890'.split('').map(d => `<button class="numpad-btn" onclick="np('${d}')">${d}</button>`).join('')}</div>
         <div class="numpad-row">
           <button class="numpad-btn btn-space" onclick="np(' ')">SPASI</button>
           <button class="numpad-btn" onclick="np('/')">/</button>
           <button class="numpad-btn" onclick="npc()">,</button>
           <button class="numpad-btn btn-del" onclick="np('DEL')">⌫</button>
         </div>
       </div>`
    : '';
  const warnHtml =
    `<div id="tiWarn" style="display:none;color:var(--danger);font-size:.82em;font-weight:600;margin-top:6px;text-align:center">
       ⚠ Masukkan 2 jawaban dipisah spasi. Contoh: <strong>48 50</strong>
     </div>`;
  $('questionContent').innerHTML =
    `<div class="q-label">Soal No. ${qi+1}${skB()}</div>
     <div class="q-text">${q.question}</div>
     <div class="input-wrap">
       <input type="text" id="userAnswer" placeholder="${iT ? 'Contoh: 48 50' : 'Jawaban...'}"
         autocomplete="off" ${iT && isMobile ? 'readonly' : ''} oninput="tiOninput(this)"/>
       ${warnHtml}${npHtml}
     </div>`;
  $('actionBar').innerHTML =
    `<button class="btn btn-primary btn-sm" id="btnNx" onclick="tiTrySubmit()" disabled>Jawab</button>
     <button class="btn btn-outline btn-sm" onclick="skipQ()">Lewati</button>`;
  const inp = $('userAnswer');
  if (!iT) {
    inp.focus();
    inp.addEventListener('keyup', e => { if (e.key === 'Enter' && inp.value.trim()) subTI(); });
  } else if (!isMobile) {
    inp.focus();
    inp.addEventListener('keyup', e => { if (e.key === 'Enter') tiTrySubmit(); });
  }
}

function tiOninput(inp) {
  const iT = cfg.id === 'tkd6';
  if (iT) {
    const parts = inp.value.trim().split(/\s+/);
    const valid = parts.length >= 2 && parts[0] !== '' && parts[1] !== '';
    $('btnNx').disabled = !valid;
    const w = $('tiWarn'); if (w) w.style.display = 'none';
  } else {
    $('btnNx').disabled = inp.value.trim() === '';
  }
}

function tiTrySubmit() {
  const inp = $('userAnswer'); if (!inp) return;
  const val = inp.value.trim();
  const parts = val.split(/\s+/);
  const w = $('tiWarn');
  if (cfg.id === 'tkd6' && (parts.length < 2 || parts[1] === '')) {
    if (w) { w.style.display = 'block'; inp.focus(); inp.style.borderColor = 'var(--danger)'; setTimeout(() => { inp.style.borderColor = ''; }, 1800); }
    return;
  }
  if (w) w.style.display = 'none';
  if (val) subTI();
}

function subTI() {
  const q = qs[qi];
  const a = $('userAnswer').value.trim().replace(/,/g, ' ');
  let ok = false;
  for (const ca of (q.correctAnswers || [])) {
    if (a.toLowerCase() === ca.answer.replace(/,/g, ' ').trim().toLowerCase()) { ok = true; break; }
  }
  mAns(qi);
  ua.push(`${qi+1}${a}${ok ? 'v' : 'x'}`);
  if (ok) sc++;
  saveSt(); goNx();
}

// Numpad helper (dipakai rTxtI pada mobile)
function np(v) {
  const inp = $('userAnswer'); if (!inp) return;
  if (v === 'DEL') { inp.value = inp.value.slice(0, -1); }
  else if (v === ' ') { if (inp.value.trim() !== '' && !inp.value.includes(' ')) inp.value += v; }
  else {
    const p = inp.value.split(' ');
    if (p.length === 2 && p[1].length >= 6) return;
    if (p.length === 1 && p[0].length >= 6) return;
    inp.value += v;
  }
  const btn = $('btnNx');
  if (btn) {
    const p = inp.value.split(' ');
    btn.disabled = !(p.length >= 2 && p[0].trim() !== '' && p.slice(1).join(' ').trim() !== '');
  }
}
function npc() { np(','); }


// ── [5] TEXT INPUT SCORED ────────────────────────────────────────
// Soal kata — isi kata penghubung antara dua kata
// Dipakai: IST 4
// ─────────────────────────────────────────────────────────────────
function rTIS(q) {
  const pair = q.question.split('|'), w1 = pair[0] || '', w2 = pair[1] || '';
  $('questionContent').innerHTML =
    `<div class="tis-pair">
       <span class="tis-word">${w1}</span>
       <span class="tis-dash">–</span>
       <span class="tis-word">${w2}</span>
     </div>
     <p class="tis-hint">Temukan kata penghubung yang tepat antara dua kata di atas.</p>
     <div class="tis-input-wrap">
       <input id="tisAnswer" type="text" placeholder="Ketik kata penghubung..." autocomplete="off">
     </div>`;
  $('actionBar').innerHTML =
    `<button class="btn btn-primary btn-sm" onclick="subTIS('${q.answer || ''}')">Jawab</button>
     <button class="btn btn-outline btn-sm" onclick="skipQ()">Lewati</button>`;
  const inp = $('tisAnswer');
  if (inp) setTimeout(() => inp.focus(), 80);
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') subTIS(q.answer || ''); });
}

function subTIS(ans) {
  const inp = $('tisAnswer'); if (!inp || !inp.value.trim()) return;
  const v = inp.value.trim().toLowerCase();
  const ok = v === String(ans).toLowerCase();
  mAns(qi);
  ua.push(`${qi+1}|${v}|${ok ? 'v' : 'x'}`);
  if (ok) sc++;
  saveSt(); goNx();
}


// ── [6] DIGIT CHECK ──────────────────────────────────────────────
// Soal pengecekan urutan angka — klik angka sesuai urutan
// Dipakai: IST 5, IST 6
// ─────────────────────────────────────────────────────────────────
let dcCk = [];

function rDC(q) {
  const btns = ['1','2','3','4','5','6','7','8','9','0']
    .map(d => `<button class="dc-digit-btn" id="dcb-${d}" onclick="dcT('${d}')">${d}</button>`)
    .join('');
  dcCk = [];
  $('questionContent').innerHTML =
    `<div class="q-label">Soal No. ${qi+1}${skB()}</div>
     <div class="dc-question">${q.question}</div>
     <p class="dc-hint">Klik angka sesuai urutan (1–9 dulu, lalu 0)</p>
     <div class="dc-preview" id="dcP">
       <span class="dc-preview-label">Jawaban:</span>
       <span id="dcPD" style="color:var(--muted);font-style:italic">—</span>
     </div>
     <div class="dc-digits">${btns}</div>`;
  $('actionBar').innerHTML =
    `<button class="btn btn-primary btn-sm" id="btnDC" onclick="subDC()" disabled>Jawab</button>
     <button class="btn btn-outline btn-sm" onclick="dcR()">↺ Reset</button>
     <button class="btn btn-outline btn-sm" onclick="skipQ()">Lewati</button>`;
}

function dcT(d) {
  const i = dcCk.indexOf(d);
  i !== -1 ? dcCk.splice(i, 1) : dcCk.push(d);
  dcUI();
}

function dcR() { dcCk = []; dcUI(); }

function dcUI() {
  ['1','2','3','4','5','6','7','8','9','0'].forEach(d => {
    const b = $('dcb-' + d); if (!b) return;
    const p = dcCk.indexOf(d);
    b.classList.toggle('dc-checked', p !== -1);
    let o = b.querySelector('.dc-order');
    if (p !== -1) {
      if (!o) { o = document.createElement('span'); o.className = 'dc-order'; b.appendChild(o); }
      o.textContent = p + 1;
    } else if (o) o.remove();
  });
  const p = $('dcPD');
  if (p) p.innerHTML = dcCk.length
    ? dcCk.map(d => `<span class="dc-preview-digit">${d}</span>`).join('')
    : '<span style="color:var(--muted);font-style:italic">—</span>';
  $('btnDC').disabled = !dcCk.length;
}

function subDC() {
  const q = qs[qi];
  const a = dcCk.join('');
  const ok = a === (q.correctAnswers || []).join('');
  mAns(qi);
  ua.push(`${qi+1}|${a}|${ok ? 'v' : 'x'}`);
  if (ok) sc++;
  saveSt(); goNx();
}


// ── [7] AB CHOICE ────────────────────────────────────────────────
// Soal pilih A atau B (forced choice)
// Dipakai: EPPS, PAPI
// ─────────────────────────────────────────────────────────────────
function rAB(q) {
  $('questionContent').innerHTML =
    `<div class="q-label">Pasangan Soal No. ${qi+1}</div>
     <div class="options-ab">
       <button class="opt-ab" onclick="subAB('A')"><strong>A.</strong> ${q.A || (q.options && q.options.A) || '-'}</button>
       <button class="opt-ab" onclick="subAB('B')"><strong>B.</strong> ${q.B || (q.options && q.options.B) || '-'}</button>
     </div>`;
  $('actionBar').innerHTML = '';
}

function subAB(c) { ua.push(c); saveSt(); goNx(); }


// ── [8] RANKING ──────────────────────────────────────────────────
// Soal perangkingan — urutkan 12 pernyataan
// Dipakai: RMIB
// Catatan: dipanggil langsung dari renderQ(), bukan lewat RENDERERS
// ─────────────────────────────────────────────────────────────────
function renderRank() {
  const rows = qs.map((q, r) =>
    `<tr>
       <td class="col-no" style="width:36px">${r+1}</td>
       <td>${q.text}</td>
       <td><div class="btn-container">
         ${[1,2,3,4,5,6,7,8,9,10,11,12].map(n =>
           `<button class="btn-rank" id="br-${r}-${n}" onclick="rSl(${r},${n})">${n}</button>`
         ).join('')}
       </div></td>
     </tr>`
  ).join('');
  $('questionContent').innerHTML =
    `<div id="deskripsiBox">${cfg._pem || ''}</div>
     <div style="overflow-x:auto">
       <table class="ranking-table">
         <thead><tr>
           <th class="col-no" style="width:36px">No</th>
           <th>Pernyataan</th>
           <th style="width:480px">Pilihan Ranking</th>
         </tr></thead>
         <tbody>${rows}</tbody>
       </table>
     </div>`;
  $('actionBar').innerHTML = '';
  updRankUI();
}

function rSl(r, v) {
  if (rSel[r] === v) { rSel[r] = null; uNum = uNum.filter(n => n !== v); }
  else {
    if (uNum.includes(v)) return;
    if (rSel[r] !== null) uNum = uNum.filter(n => n !== rSel[r]);
    rSel[r] = v; uNum.push(v);
  }
  updRankUI(); saveSt();
  if (rSel.filter(n => n !== null).length === 12) saveRank(rSel.join(';'));
}

function updRankUI() {
  for (let r = 0; r < 12; r++) {
    const s = rSel[r];
    for (let v = 1; v <= 12; v++) {
      const b = $('br-' + r + '-' + v); if (!b) continue;
      b.classList.remove('sel', 'gone');
      if (s !== null) { v === s ? b.classList.add('sel') : b.classList.add('gone'); }
      else if (uNum.includes(v)) b.classList.add('gone');
    }
  }
}

async function saveRank(ds) {
  sl('Menyimpan...'); const id = localStorage.getItem('db_id');
  try {
    let o = {}; try { o = JSON.parse(cu[cfg.saveField] || '{}'); } catch {}
    o[cfg._taskId] = ds;
    const v = JSON.stringify(o);
    await aP(id, { [cfg.saveField]: v });
    cu[cfg.saveField] = v;
    localStorage.removeItem('_st_' + cfg._taskId);
    rSel = Array(12).fill(null); uNum = [];
    await goNext2();
  } catch(e) { alert('Gagal: ' + e.message); }
  finally { hl(); }
}