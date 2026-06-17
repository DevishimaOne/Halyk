// ═══════════════════════════════════════════════════
// HALYK LIFE EDUCATION — app.js
// ═══════════════════════════════════════════════════

let CU = null; // current user

// ══ AUTH ═══════════════════════════════════════════
document.addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });

function doLogin() {
  const login = document.getElementById('l-login').value.trim();
  const pass  = document.getElementById('l-pass').value;
  const err   = document.getElementById('login-err');
  const user  = DB_USERS.find(u => u.login===login && u.pass===pass);
  if (!user) { err.style.display='block'; return; }
  if (user.status === 'blocked') { err.style.display='block'; err.textContent='Ваш аккаунт заблокирован. Обратитесь к администратору.'; return; }
  err.style.display='none';
  CU = user;
  if (user.role==='admin') { showScreen('screen-admin'); initAdmin(); }
  else                     { showScreen('screen-user');  initUser(); }
}

function doLogout() {
  CU = null;
  document.getElementById('l-pass').value='';
  document.getElementById('login-err').style.display='none';
  document.getElementById('login-err').textContent='Неверный логин или пароль';
  showScreen('screen-login');
}

function togglePw() {
  const i = document.getElementById('l-pass');
  i.type = i.type==='password' ? 'text' : 'password';
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ══ USER INIT ══════════════════════════════════════
function initUser() {
  const ini = (CU.firstName[0]||'')+(CU.lastName?.[0]||'');
  document.getElementById('u-avatar').textContent  = ini||CU.avatar||'К';
  document.getElementById('u-name').textContent    = CU.firstName;
  document.getElementById('side-av').textContent   = ini||CU.avatar||'К';
  document.getElementById('side-uname').textContent = `${CU.firstName} ${CU.lastName}`.trim();
  updateTopStats();
  renderSideNav();
  uPage('home');
}

function updateTopStats() {
  const prog = getUserProgress(CU.id);
  const xp   = Object.values(prog).reduce((s,p)=>s+(p.xp||0), 0);
  // XP per lesson
  let totalXp=0;
  DB_COURSES.forEach(c=>{
    (c.modules||[]).forEach(m=>{
      (m.lessons||[]).forEach(l=>{
        if(isLessonDone(CU.id,l.id)) totalXp+=l.xp||0;
      });
    });
  });
  document.getElementById('u-xp').textContent = totalXp;
  document.getElementById('u-streak').textContent = getStreak();
}

function getStreak() {
  const key = 'streak_'+CU.id;
  let data = JSON.parse(localStorage.getItem(key)||'{"count":0,"last":null}');
  const today = todayStr();
  if (data.last===today) return data.count;
  const yest = new Date(); yest.setDate(yest.getDate()-1);
  const yStr = yest.toISOString().slice(0,10);
  data.count = data.last===yStr ? data.count+1 : 1;
  data.last = today;
  localStorage.setItem(key, JSON.stringify(data));
  return data.count;
}

function renderSideNav() {
  const nsjCourses    = DB_COURSES.filter(c=>c.cat==='nsj'||c.cat==='general');
  const nonsjCourses  = DB_COURSES.filter(c=>c.cat==='nonsj');

  document.getElementById('side-nsj').innerHTML = nsjCourses.map(c=>{
    const [done,total] = getCourseDone(CU.id, c.id);
    const pct = total ? Math.round(done/total*100) : 0;
    const accessible = hasAccess(CU,c.id);
    const icon = c.status==='wip'?'🔒':pct===100?'✅':done>0?'▶️':'○';
    return `<button class="sn-item" onclick="${c.status==='wip'?'toast(\"Курс в разработке\")':`uOpenCourse(${c.id})`}" style="${!accessible?'opacity:.4':''}" title="${!accessible?'Нет доступа':''}">
      <span>${icon}</span><span style="flex:1;text-align:left;font-size:.8rem">${c.name}</span>
      ${pct>0&&pct<100?`<span style="font-size:.7rem;color:var(--muted)">${pct}%</span>`:''}
    </button>`;
  }).join('');

  document.getElementById('side-nonsj').innerHTML = nonsjCourses.map(c=>`
    <button class="sn-item" style="opacity:.5;cursor:default"><span>🔒</span><span style="flex:1;text-align:left;font-size:.8rem">${c.name}</span></button>
  `).join('') || `<div style="font-size:.76rem;color:var(--muted);padding:5px 12px">Скоро появятся</div>`;
}

// ══ USER PAGES ═════════════════════════════════════
function uPage(name) {
  document.querySelectorAll('#screen-user .page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#screen-user .sn-item[data-p]').forEach(n=>n.classList.remove('active'));
  const pg = document.getElementById('upage-'+name);
  if (pg) { pg.classList.add('active'); buildPage(name, pg); }
  const nav = document.querySelector(`#screen-user .sn-item[data-p="${name}"]`);
  if (nav) nav.classList.add('active');
  document.getElementById('user-side').classList.remove('open');
  closeDropdowns();
}

function buildPage(name, el) {
  if (name==='home')       el.innerHTML = buildHome();
  if (name==='my-courses') el.innerHTML = buildMyCourses();
  if (name==='progress')   el.innerHTML = buildProgress();
  if (name==='certs')      el.innerHTML = buildCerts();
  if (name==='leaderboard') el.innerHTML = buildLeaderboard();
}

function buildHome() {
  const [totDone,totAll] = (() => {
    let d=0,a=0;
    DB_COURSES.filter(c=>hasAccess(CU,c.id)).forEach(c=>{const[cd,ca]=getCourseDone(CU.id,c.id);d+=cd;a+=ca;});
    return [d,a];
  })();
  const pct = totAll ? Math.round(totDone/totAll*100) : 0;
  let totalXp=0;
  DB_COURSES.forEach(c=>(c.modules||[]).forEach(m=>(m.lessons||[]).forEach(l=>{if(isLessonDone(CU.id,l.id))totalXp+=l.xp||0;})));

  const nsjCat  = DB_COURSES.filter(c=>c.cat==='nsj'||c.cat==='general');
  const salCat  = DB_COURSES.filter(c=>c.cat==='sales');
  const nonsjCat= DB_COURSES.filter(c=>c.cat==='nonsj');

  const cards = (list) => list.map(c=>{
    const [done,total] = getCourseDone(CU.id,c.id);
    const p = total ? Math.round(done/total*100) : 0;
    const acc = hasAccess(CU,c.id);
    const isWip = c.status==='wip';
    return `<div class="course-card ${isWip?'wip':''}" style="--cc:${c.color}" onclick="${isWip?`toast('Курс &quot;${c.name}&quot; находится в разработке',true)`:`uOpenCourse(${c.id})`}${!acc?`;event.stopPropagation();toast('Нет доступа к курсу. Обратитесь к администратору.','error')`:''}" >
      <div class="cc-icon">${c.icon}</div>
      <div class="cc-badge" style="background:${c.color}22;color:${c.color}">${catLabel(c.cat)}</div>
      <div class="cc-name">${c.name}</div>
      <div class="cc-desc">${c.desc}</div>
      <div class="cc-meta"><span>📚 ${(c.modules||[]).length} модулей</span><span>⏱️ ~${totalMin(c)} мин</span></div>
      ${total>0?`<div class="prog-bar"><div class="prog-fill" style="width:${p}%;background:${c.color}"></div></div><div class="prog-label">${done}/${total} уроков · ${p}%</div>`:''}
      ${isWip?'<div class="wip-overlay">🔨 В разработке</div>':''}
      ${!acc&&!isWip?`<div class="wip-overlay">🔒 Нет доступа</div>`:''}
    </div>`;
  }).join('');

  return `
    <div class="hero-banner">
      <div class="hb-ey">Платформа дистанционного обучения</div>
      <div class="hb-title">Halyk Life Education</div>
      <div class="hb-sub">Страховые продукты · Техника продаж · Нормативные документы</div>
      <div class="hb-stats">
        <div><div class="hbs-val">${totDone}</div><div class="hbs-lab">Уроков пройдено</div></div>
        <div><div class="hbs-val">${pct}%</div><div class="hbs-lab">Общий прогресс</div></div>
        <div><div class="hbs-val">${totalXp}</div><div class="hbs-lab">XP заработано</div></div>
        <div><div class="hbs-val">${getStreak()}</div><div class="hbs-lab">Дней серии</div></div>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card green"><div class="stat-icon">📖</div><div class="stat-val">${DB_COURSES.filter(c=>c.status==='active').length}</div><div class="stat-lab">Активных курсов</div></div>
      <div class="stat-card"><div class="stat-icon">🔨</div><div class="stat-val">${DB_COURSES.filter(c=>c.status==='wip').length}</div><div class="stat-lab">В разработке</div></div>
      <div class="stat-card"><div class="stat-icon">🎓</div><div class="stat-val">${DB_RESULTS.filter(r=>r.userId===CU.id&&r.passed).length}</div><div class="stat-lab">Тестов сдано</div></div>
      <div class="stat-card"><div class="stat-icon">🏅</div><div class="stat-val">${DB_RESULTS.filter(r=>r.userId===CU.id&&r.passed&&r.score>=70).length}</div><div class="stat-lab">Сертификатов</div></div>
    </div>
    <div class="cat-section">
      <div class="cat-header"><div class="cat-title">📚 Накопительное страхование жизни (НСЖ)</div><span class="cat-badge">Приоритетное направление</span></div>
      <div class="courses-grid">${cards(nsjCat)}</div>
    </div>
    ${salCat.length?`<div class="cat-section">
      <div class="cat-header"><div class="cat-title">🎯 Техника продаж</div><span class="cat-badge tag-sales">Профессиональное развитие</span></div>
      <div class="courses-grid">${cards(salCat)}</div>
    </div>`:''}
    <div class="cat-section">
      <div class="cat-header"><div class="cat-title">🔒 Ненакопительное страхование</div><span class="cat-badge tag-wip">Скоро</span></div>
      <div style="background:var(--mist);border:1px dashed var(--border);border-radius:var(--r);padding:28px;text-align:center;color:var(--muted)">
        <div style="font-size:1.5rem;margin-bottom:8px">🔨</div>
        <div style="font-weight:600;margin-bottom:4px">Раздел находится в разработке</div>
        <div style="font-size:.82rem">Курсы по ненакопительному страхованию появятся в ближайшее время</div>
      </div>
    </div>`;
}

function catLabel(cat) {
  return { nsj:'НСЖ', nonsj:'Ненакопительное', general:'Общее', sales:'Продажи' }[cat]||cat;
}
function totalMin(c) {
  return (c.modules||[]).reduce((s,m)=>(m.lessons||[]).reduce((ss,l)=>ss+(l.dur||0),s),0);
}

function buildMyCourses() {
  const started = DB_COURSES.filter(c=>{const[d]=getCourseDone(CU.id,c.id);return d>0;});
  if (!started.length) return `<div class="view-header"><h2>Мои курсы</h2></div><div class="empty"><span>📖</span>Вы ещё не начали ни одного курса. Перейдите на главную!</div>`;
  return `<div class="view-header"><h2>Мои курсы</h2><p>Курсы в процессе изучения</p></div>
    <div class="courses-grid">${started.map(c=>{
      const [done,total]=getCourseDone(CU.id,c.id);
      const p=total?Math.round(done/total*100):0;
      return `<div class="course-card" style="--cc:${c.color}" onclick="uOpenCourse(${c.id})">
        <div class="cc-icon">${c.icon}</div>
        <div class="cc-name">${c.name}</div>
        <div class="cc-meta"><span>${done}/${total} уроков</span><span>${p}%</span></div>
        <div class="prog-bar"><div class="prog-fill" style="width:${p}%;background:${c.color}"></div></div>
      </div>`;
    }).join('')}</div>`;
}

function buildProgress() {
  let totalDone=0,totalAll=0,totalXp=0;
  DB_COURSES.forEach(c=>{const[d,a]=getCourseDone(CU.id,c.id);totalDone+=d;totalAll+=a;});
  DB_COURSES.forEach(c=>(c.modules||[]).forEach(m=>(m.lessons||[]).forEach(l=>{if(isLessonDone(CU.id,l.id))totalXp+=l.xp||0;})));
  const pct=totalAll?Math.round(totalDone/totalAll*100):0;
  const attempts=DB_RESULTS.filter(r=>r.userId===CU.id).length;
  const passed=DB_RESULTS.filter(r=>r.userId===CU.id&&r.passed).length;

  return `<div class="view-header"><h2>Мой прогресс</h2></div>
    <div class="stats-grid">
      <div class="stat-card green"><div class="stat-icon">⭐</div><div class="stat-val">${totalXp}</div><div class="stat-lab">XP заработано</div></div>
      <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-val">${pct}%</div><div class="stat-lab">Общий прогресс</div></div>
      <div class="stat-card"><div class="stat-icon">📖</div><div class="stat-val">${totalDone}/${totalAll}</div><div class="stat-lab">Уроков пройдено</div></div>
      <div class="stat-card"><div class="stat-icon">🎯</div><div class="stat-val">${passed}/${attempts}</div><div class="stat-lab">Тестов сдано</div></div>
    </div>
    <div class="section-title">По курсам</div>
    ${DB_COURSES.filter(c=>c.status!=='wip').map(c=>{
      const [d,a]=getCourseDone(CU.id,c.id);
      const p=a?Math.round(d/a*100):0;
      const best=DB_RESULTS.filter(r=>r.userId===CU.id&&r.courseId===c.id&&r.passed).sort((a,b)=>b.score-a.score)[0];
      return `<div class="prog-course-row">
        <div class="pcr-head"><span class="pcr-name">${c.icon} ${c.name}</span><span class="pcr-pct">${p}%</span></div>
        <div class="prog-bar"><div class="prog-fill" style="width:${p}%;background:${c.color}"></div></div>
        <div class="pcr-meta">
          <span>📚 ${d}/${a} уроков</span>
          <span>🎯 Тестов: ${best?best.score+'%':'—'}</span>
          ${best?'<span style="color:var(--g)">✅ Сертификат</span>':''}
        </div>
      </div>`;
    }).join('')}
    ${DB_RESULTS.filter(r=>r.userId===CU.id).length?`
    <div class="section-title" style="margin-top:24px">История тестов</div>
    <div class="table-wrap"><table class="adm-table">
      <thead><tr><th>Курс</th><th>Дата</th><th>Результат</th><th>Статус</th></tr></thead>
      <tbody>${DB_RESULTS.filter(r=>r.userId===CU.id).sort((a,b)=>b.id-a.id).map(r=>{
        const c=getCourse(r.courseId);
        return `<tr><td>${c?.icon} ${c?.name}</td><td>${r.date}</td><td><strong>${r.score}%</strong></td>
          <td><span class="status-badge ${r.passed?'sb-active':'sb-blocked'}">${r.passed?'✅ Пройден':'❌ Не пройден'}</span></td></tr>`;
      }).join('')}</tbody>
    </table></div>`:''}`;
}

function buildCerts() {
  const certs = DB_COURSES.map(c=>{
    const best=DB_RESULTS.filter(r=>r.userId===CU.id&&r.courseId===c.id&&r.passed).sort((a,b)=>b.score-a.score)[0];
    return best?{course:c,result:best}:null;
  }).filter(Boolean);

  if (!certs.length) return `<div class="view-header"><h2>Сертификаты</h2></div><div class="empty"><span>🏅</span>Сертификатов пока нет.<br>Сдайте тест на 70% и выше!</div>`;
  return `<div class="view-header"><h2>Сертификаты</h2><p>Выдаются за прохождение тестов с результатом ≥ 70%</p></div>
    <div class="certs-grid">${certs.map(({course:c,result:r})=>`
      <div class="cert-card">
        <div class="cert-badge">${catLabel(c.cat)}</div>
        <div class="cert-name">${c.icon} ${c.name}</div>
        <div class="cert-score">${r.score}%</div>
        <div class="cert-date">Выдан: ${r.date}</div>
        <div style="margin-top:10px"><span style="font-size:.74rem;font-weight:700;background:var(--gl);color:var(--gd);padding:3px 9px;border-radius:20px">✅ Сертификат выдан</span></div>
      </div>`).join('')}</div>`;
}

function buildLeaderboard() {
  const users = DB_USERS.filter(u=>u.role==='user');
  const rows = users.map(u=>{
    let xp=0;
    DB_COURSES.forEach(c=>(c.modules||[]).forEach(m=>(m.lessons||[]).forEach(l=>{if(isLessonDone(u.id,l.id))xp+=l.xp||0;})));
    const ini=(u.firstName[0]||'')+(u.lastName?.[0]||'');
    return {user:u,xp,ini};
  }).sort((a,b)=>b.xp-a.xp).map((r,i)=>({...r,rank:i+1}));

  const medals=['🥇','🥈','🥉'];
  return `<div class="view-header"><h2>🏆 Рейтинг знатоков</h2><p>По заработанному XP</p></div>
    ${rows.map(r=>`<div class="lb-row ${r.user.id===CU.id?'me':''}">
      <div class="lb-rank">${r.rank<=3?medals[r.rank-1]:r.rank}</div>
      <div class="lb-av">${r.ini}</div>
      <div class="lb-info"><div class="lb-name">${r.user.firstName} ${r.user.lastName} ${r.user.id===CU.id?'<span style="font-size:.7rem;background:var(--g);color:#fff;padding:1px 6px;border-radius:10px">Вы</span>':''}</div><div class="lb-dept">${r.user.dept}</div></div>
      <div class="lb-pts">${r.xp} XP</div>
    </div>`).join('')}`;
}

// ══ OPEN COURSE ════════════════════════════════════
function uOpenCourse(courseId) {
  const c = getCourse(courseId);
  if (!c || c.status==='wip') return;
  if (!hasAccess(CU,courseId)) { toast('У вас нет доступа к этому курсу','error'); return; }

  // Build course detail view
  const pg = document.getElementById('upage-home');
  const [done,total] = getCourseDone(CU.id,courseId);
  const pct = total ? Math.round(done/total*100) : 0;

  pg.innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="uPage('home')" style="margin-bottom:16px">← Все курсы</button>
    <div class="hero-banner" style="background:linear-gradient(135deg,${c.color}CC,${c.color}99)">
      <div class="hb-ey">${catLabel(c.cat)}</div>
      <div class="hb-title">${c.icon} ${c.name}</div>
      <div class="hb-sub">${c.desc}</div>
      <div class="hb-stats">
        <div><div class="hbs-val">${done}/${total}</div><div class="hbs-lab">Уроков</div></div>
        <div><div class="hbs-val">${pct}%</div><div class="hbs-lab">Прогресс</div></div>
        <div><div class="hbs-val">${(c.modules||[]).length}</div><div class="hbs-lab">Модулей</div></div>
      </div>
    </div>
    <div class="section-title" style="margin-top:20px">Программа курса</div>
    ${(c.modules||[]).sort((a,b)=>a.order-b.order).map(m=>{
      const mDone = (m.lessons||[]).filter(l=>isLessonDone(CU.id,l.id)).length;
      const mTotal = m.lessons?.length||0;
      const mPct = mTotal ? Math.round(mDone/mTotal*100) : 0;
      return `<div class="module-row" onclick="toggleModuleLessons(this,${c.id},${m.id})">
        <div class="mr-icon" style="background:${m.color}22">${m.icon}</div>
        <div class="mr-info">
          <div class="mr-name">${m.name}</div>
          <div class="mr-desc">${m.desc}</div>
          <div class="mr-meta"><span>📚 ${mTotal} уроков</span><span>⭐ ${(m.lessons||[]).reduce((s,l)=>s+(l.xp||0),0)} XP</span></div>
        </div>
        <div class="mr-right"><div class="mr-pct">${mPct}%</div></div>
      </div>
      <div id="mod-lessons-${m.id}" style="display:none;margin-bottom:10px;padding-left:16px;border-left:3px solid ${m.color}22">
        ${(m.lessons||[]).sort((a,b)=>a.order-b.order).map(l=>{
          const done2 = isLessonDone(CU.id,l.id);
          return `<div class="lesson-row ${done2?'done':''}" onclick="event.stopPropagation();startLesson(${c.id},${m.id},${l.id})">
            <div class="lr-num">${done2?'✓':l.order}</div>
            <div class="lr-name">${l.title}</div>
            <span style="font-size:.72rem;color:var(--muted)">${typeLabel(l.type)} · ${l.dur}мин · ⭐${l.xp}</span>
          </div>`;
        }).join('')}
      </div>`;
    }).join('')}`;
  pg.classList.add('active');
  document.querySelectorAll('#screen-user .page').forEach(p=>{ if(p!==pg)p.classList.remove('active'); });
}

function toggleModuleLessons(el, cid, mid) {
  const panel = document.getElementById('mod-lessons-'+mid);
  panel.style.display = panel.style.display==='none' ? 'block' : 'none';
}

function typeLabel(t) {
  return {story:'📖',quiz:'📝',case:'💼',simulator:'🎭'}[t]||'📖';
}

// ══ LESSON ENGINE ══════════════════════════════════
let LS = { cid:0, mid:0, lid:0, lesson:null, module:null, course:null, steps:[], step:0, answers:{}, done:false };

function startLesson(cid, mid, lid) {
  const course  = getCourse(cid);
  const module  = getModule(cid, mid);
  const lesson  = getLesson(cid, mid, lid);
  if (!lesson) return;

  LS = { cid, mid, lid, lesson, module, course, steps:[], step:0, answers:{}, done:false };

  if (lesson.isQuiz || lesson.type==='quiz') {
    LS.steps = (lesson.questions||[]).map((q,i)=>({type:'question',q,idx:i}));
    LS.steps.push({type:'quiz-result'});
  } else {
    LS.steps = [{type:'intro'}, {type:'main'}];
  }

  document.getElementById('lbar-xp').textContent = `⭐ ${lesson.xp||0} XP`;
  renderLessonStep();
  const shell = document.getElementById('lesson-shell');
  shell.style.display = 'flex';
}

function closeLesson() {
  document.getElementById('lesson-shell').style.display = 'none';
  updateTopStats();
  renderSideNav();
  uOpenCourse(LS.cid);
}

function lsPrev() { if(LS.step>0){LS.step--;renderLessonStep();} }
function lsNext() {
  const step = LS.steps[LS.step];
  if (step?.type==='question' && LS.answers[LS.step]===undefined) { toast('Выберите ответ'); return; }
  if (LS.step < LS.steps.length-1) { LS.step++; renderLessonStep(); }
  else { completeLesson(); }
}

function renderLessonStep() {
  const step  = LS.steps[LS.step];
  const total = LS.steps.length;
  const pct   = Math.round(LS.step/(total-1||1)*100);
  document.getElementById('lbar-fill').style.width  = pct+'%';
  document.getElementById('lbar-label').textContent = `${LS.step+1}/${total}`;
  document.getElementById('ls-prev').disabled = LS.step===0;
  const nextBtn = document.getElementById('ls-next');
  nextBtn.textContent = LS.step===total-1 ? '✓ Завершить' : 'Продолжить →';

  const body = document.getElementById('lesson-body');
  body.scrollTop = 0;
  const l = LS.lesson; const m = LS.module; const c = LS.course;

  if (!step) return;

  if (step.type==='intro') {
    body.innerHTML = `<div class="lesson-title-wrap">
      <div class="lesson-eyebrow">${m.icon} ${m.name}</div>
      <div class="lesson-title">${l.title}</div>
      <div class="lesson-meta-row"><span>⏱️ ~${l.dur}мин</span><span>⭐ ${l.xp}XP</span><span>${typeLabel(l.type)}</span></div>
    </div>
    <div class="lesson-intro">${l.intro||''}</div>`;
  }
  else if (step.type==='main') {
    let html = '';
    if (l.text) html += `<div class="block-vnd"><div class="vnd-label">📄 Учебный материал</div><div class="vnd-text">${l.text.replace(/\n/g,'<br/>')}</div></div>`;
    if (l.keyPoints?.length) html += `<div class="block block-kp"><div class="kp-title">✅ Ключевые тезисы</div>${l.keyPoints.map(k=>`<div class="kp-item">${k}</div>`).join('')}</div>`;
    body.innerHTML = html || '<div class="empty">Нет материала</div>';
  }
  else if (step.type==='question') {
    const q = step.q; const answered = LS.answers[LS.step];
    body.innerHTML = `<div class="quiz-wrap">
      <div class="q-progress">
        <span class="q-num">Вопрос ${step.idx+1}/${LS.lesson.questions.length}</span>
        <div class="prog-bar" style="flex:1;margin:0"><div class="prog-fill" style="width:${Math.round((step.idx+1)/LS.lesson.questions.length*100)}%;background:var(--g)"></div></div>
      </div>
      <div class="q-card">
        <div class="q-text">${q.text}</div>
        <div class="opts">${q.options.map((opt,i)=>{
          let cls='';
          if(answered!==undefined){if(i===q.correct)cls='correct';else if(i===answered)cls='wrong';}
          else if(answered===i)cls='selected';
          return `<div class="opt ${answered===i&&answered!==undefined?'selected':''} ${cls}" onclick="pickAnswer(${LS.step},${i})">
            <div class="opt-dot"></div><div class="opt-text">${opt}</div>
          </div>`;
        }).join('')}</div>
        <div class="q-explain ${answered!==undefined?'show':''}">${answered!==undefined?`💡 ${q.explanation}`:''}</div>
      </div></div>`;
  }
  else if (step.type==='quiz-result') {
    nextBtn.textContent='✓ Завершить';
    const qs = LS.lesson.questions||[];
    const correct = qs.filter((q,i)=>LS.answers[i]===q.correct).length;
    const score = Math.round(correct/qs.length*100);
    const passed = score>=70;
    body.innerHTML = `<div class="completion">
      <div class="compl-icon">${passed?'🏆':'📖'}</div>
      <div class="compl-title">${score}%</div>
      <div class="compl-sub">${passed?'✅ Тест пройден!':'❌ Нужно повторить материал (мин. 70%)'}</div>
      <div class="compl-pts">⭐ +${passed?LS.lesson.xp:Math.round(LS.lesson.xp*score/100)} XP</div>
      <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:16px 20px;text-align:left;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:.85rem"><span>Правильных ответов</span><strong>${correct}/${qs.length}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:.85rem"><span>Результат</span><strong style="color:${passed?'var(--g)':'var(--red)'}">${score}%${passed?' ✅':' ❌'}</strong></div>
      </div>
    </div>`;
    // Save result
    if (!LS.done) {
      const r = {id:DB_IDS.result++,userId:CU.id,courseId:LS.cid,lessonId:LS.lid,score,passed,date:todayStr()};
      DB_RESULTS.push(r);
      markLessonDone(CU.id, LS.lid, score);
      LS.done=true;
      dbSave();
      if(passed) toast(`🏆 Тест пройден! ${score}% — отличная работа!`,'success');
      else toast(`📖 ${score}% — нужно ещё подготовиться`,'info');
    }
  }
}

function pickAnswer(stepIdx, optIdx) {
  if (LS.answers[stepIdx]!==undefined) return;
  LS.answers[stepIdx] = optIdx;
  const q = LS.steps[stepIdx].q;
  if(optIdx===q.correct) toast('✅ Правильно!','success');
  else toast('❌ Неверно — прочитайте пояснение','error');
  renderLessonStep();
}

function completeLesson() {
  if (!LS.done) {
    markLessonDone(CU.id, LS.lid, 100);
    LS.done=true;
    const xp=LS.lesson.xp||0;
    toast(`✅ +${xp}XP — урок пройден!`,'points');
    dbSave();
  }
  // Find next lesson
  const m=LS.module; const c=LS.course;
  const lessons=(m.lessons||[]).sort((a,b)=>a.order-b.order);
  const idx=lessons.findIndex(l=>l.id===LS.lid);
  const next=lessons[idx+1];
  const body=document.getElementById('lesson-body');
  body.innerHTML=`<div class="completion">
    <div class="compl-icon">✅</div>
    <div class="compl-title">Урок завершён!</div>
    <div class="compl-sub">«${LS.lesson.title}»</div>
    <div class="compl-pts">⭐ +${LS.lesson.xp||0} XP</div>
    <div class="compl-actions">
      ${next?`<button class="btn btn-primary btn-lg" onclick="startLesson(${LS.cid},${LS.mid},${next.id})">→ ${next.title}</button>`:''}
      <button class="btn btn-secondary btn-lg" onclick="closeLesson()">← К курсу</button>
    </div>
  </div>`;
  document.getElementById('ls-next').style.display='none';
}

// ══ ADMIN INIT ═════════════════════════════════════
function initAdmin() {
  aTab('adm-dash');
  document.getElementById('notif-dot').style.display = 'block';
  document.getElementById('notif-dot').textContent = DB_NOTIFS.length;
}

function aTab(name) {
  document.querySelectorAll('#screen-admin .page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#admin-side .sn-item').forEach(n=>{ n.classList.remove('active'); n.style.color='rgba(255,255,255,.55)'; n.style.background=''; });
  const pg = document.getElementById('apage-'+name);
  if (pg) { pg.classList.add('active'); buildAdminPage(name, pg); }
  const nav = document.querySelector(`#admin-side .sn-item[data-at="${name}"]`);
  if (nav) { nav.classList.add('active'); nav.style.color='#4ADE80'; nav.style.background='rgba(0,166,81,.18)'; }
  document.getElementById('admin-side').classList.remove('open');
  closeDropdowns();
}

function buildAdminPage(name, el) {
  if (name==='adm-dash')      el.innerHTML = buildAdminDash();
  if (name==='adm-users')     el.innerHTML = buildAdminUsers();
  if (name==='adm-catalog')   el.innerHTML = buildAdminCatalog();
  if (name==='adm-content')   el.innerHTML = buildAdminContent();
  if (name==='adm-results')   el.innerHTML = buildAdminResults();
  if (name==='adm-analytics') el.innerHTML = buildAdminAnalytics();
  if (name==='adm-assign')    el.innerHTML = buildAdminAssign();
}

// ── Admin Dashboard ──
function buildAdminDash() {
  const consultants = DB_USERS.filter(u=>u.role==='user');
  const active  = consultants.filter(u=>u.status==='active').length;
  const blocked = consultants.filter(u=>u.status==='blocked').length;
  const passed  = DB_RESULTS.filter(r=>r.passed).length;
  const avgScore= DB_RESULTS.length ? Math.round(DB_RESULTS.reduce((s,r)=>s+r.score,0)/DB_RESULTS.length) : 0;
  const atRisk  = consultants.filter(u=>{
    const p=getUserProgress(u.id);
    const lastDone=Object.values(p).sort((a,b)=>b.date>a.date?1:-1)[0]?.date;
    if(!lastDone) return u.status==='active';
    return ((new Date()-new Date(lastDone))/864e5)>7;
  });
  const deadlineSoon = consultants.filter(u=>u.deadline&&((new Date(u.deadline)-new Date())/864e5)<=7&&((new Date(u.deadline)-new Date())/864e5)>=0);

  return `<div class="view-header"><h2>📊 Дашборд</h2><p>${new Date().toLocaleDateString('ru-KZ',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p></div>
  <div class="stats-grid" style="grid-template-columns:repeat(6,1fr)">
    <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-val">${consultants.length}</div><div class="stat-lab">Консультантов</div></div>
    <div class="stat-card green"><div class="stat-icon">✅</div><div class="stat-val">${active}</div><div class="stat-lab">Активных</div></div>
    <div class="stat-card" style="${blocked?'border-color:#FECACA;background:#FFF5F5':''}"><div class="stat-icon">🔒</div><div class="stat-val" style="${blocked?'color:var(--red)':''}">${blocked}</div><div class="stat-lab">Заблокированных</div></div>
    <div class="stat-card"><div class="stat-icon">🎯</div><div class="stat-val">${passed}</div><div class="stat-lab">Тестов сдано</div></div>
    <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-val">${avgScore}%</div><div class="stat-lab">Средний балл</div></div>
    <div class="stat-card" style="${deadlineSoon.length?'border-color:#FDE68A;background:#FFFBF0':''}"><div class="stat-icon">⏰</div><div class="stat-val" style="${deadlineSoon.length?'color:var(--amber)':''}">${deadlineSoon.length}</div><div class="stat-lab">Дедлайн < 7 дней</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
    <div>
      <div class="section-title">⚠️ Требуют внимания</div>
      ${atRisk.slice(0,5).map(u=>`<div style="background:#fff;border:1px solid #FECACA;border-radius:var(--rs);padding:11px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
        <span>⚠️</span>
        <div style="flex:1"><div style="font-size:.84rem;font-weight:600">${u.firstName} ${u.lastName}</div>
        <div style="font-size:.72rem;color:var(--muted)">${u.dept}</div></div>
        <button class="btn btn-secondary btn-sm" onclick="sendReminder('${u.firstName} ${u.lastName}')">📨 Напомнить</button>
      </div>`).join('')||'<div style="text-align:center;padding:20px;color:var(--muted)">✅ Все в норме</div>'}
    </div>
    <div>
      <div class="section-title">🏆 Топ-5 по прогрессу</div>
      ${DB_USERS.filter(u=>u.role==='user').map(u=>{
        let xp=0;DB_COURSES.forEach(c=>(c.modules||[]).forEach(m=>(m.lessons||[]).forEach(l=>{if(isLessonDone(u.id,l.id))xp+=l.xp||0;})));
        return {u,xp};
      }).sort((a,b)=>b.xp-a.xp).slice(0,5).map(({u,xp},i)=>`
        <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
          <div style="width:20px;font-size:.85rem;font-weight:800;color:var(--muted);text-align:center">${['🥇','🥈','🥉','4','5'][i]}</div>
          <div style="width:28px;height:28px;border-radius:50%;background:var(--g);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700">${(u.firstName[0]||'')+(u.lastName?.[0]||'')}</div>
          <div style="flex:1"><div style="font-size:.84rem;font-weight:600">${u.firstName} ${u.lastName}</div><div style="font-size:.7rem;color:var(--muted)">${u.dept}</div></div>
          <div style="font-size:.88rem;font-weight:800;color:var(--g)">${xp}XP</div>
        </div>`).join('')}
    </div>
  </div>
  <div class="section-title">🕐 Последние результаты</div>
  <div class="table-wrap"><table class="adm-table">
    <thead><tr><th>Консультант</th><th>Курс</th><th>Результат</th><th>Дата</th><th>Статус</th></tr></thead>
    <tbody>${DB_RESULTS.sort((a,b)=>b.id-a.id).slice(0,8).map(r=>{
      const u=getUser(r.userId);const c=getCourse(r.courseId);
      return `<tr><td><strong>${u?.firstName} ${u?.lastName}</strong></td><td>${c?.icon} ${c?.name}</td>
        <td><strong>${r.score}%</strong></td><td>${r.date}</td>
        <td><span class="status-badge ${r.passed?'sb-active':'sb-blocked'}">${r.passed?'✅ Пройден':'❌ Не пройден'}</span></td></tr>`;
    }).join('')||'<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--muted)">Нет данных</td></tr>'}</tbody>
  </table></div>`;
}

// ── Admin Users ──
function buildAdminUsers(search='', deptF='', statusF='') {
  let users = DB_USERS.filter(u=>u.role==='user');
  if(search) users=users.filter(u=>(u.firstName+' '+u.lastName+' '+u.login).toLowerCase().includes(search.toLowerCase()));
  if(deptF) users=users.filter(u=>u.dept===deptF);
  if(statusF==='active') users=users.filter(u=>u.status==='active');
  if(statusF==='blocked') users=users.filter(u=>u.status==='blocked');

  return `<div class="view-header"><div><h2>👥 Консультанты</h2><p>Управление аккаунтами и доступами</p></div>
    <div style="display:flex;gap:10px"><button class="btn btn-secondary" onclick="exportUsers()">⬇️ Экспорт</button><button class="btn btn-primary" onclick="openUserModal()">+ Добавить</button></div>
  </div>
  <div class="filter-bar">
    <input class="filter-search" type="text" placeholder="🔍 Поиск по имени, логину..." value="${search}" oninput="refreshUsers(this.value,document.getElementById('f-dept').value,document.getElementById('f-status').value)"/>
    <select id="f-dept" onchange="refreshUsers(document.querySelector('.filter-search').value,this.value,document.getElementById('f-status').value)">
      <option value="">Все подразделения</option>
      ${[...new Set(DB_USERS.map(u=>u.dept))].map(d=>`<option${deptF===d?' selected':''}>${d}</option>`).join('')}
    </select>
    <select id="f-status" onchange="refreshUsers(document.querySelector('.filter-search').value,document.getElementById('f-dept').value,this.value)">
      <option value="">Все статусы</option>
      <option value="active"${statusF==='active'?' selected':''}>Активные</option>
      <option value="blocked"${statusF==='blocked'?' selected':''}>Заблокированные</option>
    </select>
  </div>
  <div class="table-wrap"><table class="adm-table">
    <thead><tr><th>Консультант</th><th>Логин</th><th>Подразделение</th><th>Доступ к курсам</th><th>Прогресс</th><th>Дедлайн</th><th>Статус</th><th>Действия</th></tr></thead>
    <tbody>${users.map(u=>{
      let xp=0,totalDone=0,totalAll=0;
      DB_COURSES.forEach(c=>{const[d,a]=getCourseDone(u.id,c.id);totalDone+=d;totalAll+=a;(c.modules||[]).forEach(m=>(m.lessons||[]).forEach(l=>{if(isLessonDone(u.id,l.id))xp+=l.xp||0;}));});
      const pct=totalAll?Math.round(totalDone/totalAll*100):0;
      const dl=u.deadline?new Date(u.deadline).toLocaleDateString('ru-KZ',{day:'2-digit',month:'short'}):'—';
      const daysLeft=u.deadline?Math.ceil((new Date(u.deadline)-new Date())/864e5):null;
      const dlColor=daysLeft!==null?(daysLeft<=3?'var(--red)':daysLeft<=7?'var(--amber)':'var(--g)'):'var(--muted)';
      const courseCount = u.courses==='all' ? 'Все' : (u.courses||[]).length+' курс(а)';
      const ini=(u.firstName[0]||'')+(u.lastName?.[0]||'');
      return `<tr>
        <td><div style="display:flex;align-items:center;gap:8px">
          <div style="width:30px;height:30px;border-radius:50%;background:${u.status==='blocked'?'var(--muted)':'var(--g)'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700">${ini}</div>
          <div><div style="font-weight:600;font-size:.88rem">${u.firstName} ${u.lastName}</div><div style="font-size:.72rem;color:var(--muted)">${u.email}</div></div>
        </div></td>
        <td>${u.login}</td>
        <td style="font-size:.84rem">${u.dept}</td>
        <td><span style="font-size:.78rem;background:var(--gl);color:var(--gd);padding:2px 8px;border-radius:10px;font-weight:600">${courseCount}</span></td>
        <td>
          <div style="font-size:.82rem;font-weight:700;margin-bottom:4px">${pct}%</div>
          <div style="height:4px;background:var(--mist);border-radius:4px;overflow:hidden;width:80px">
            <div style="height:100%;width:${pct}%;background:${pct>=70?'var(--g)':pct>=40?'var(--amber)':'var(--red)'}"></div>
          </div>
          <div style="font-size:.7rem;color:var(--muted);margin-top:2px">${totalDone}/${totalAll} ур. · ${xp}XP</div>
        </td>
        <td><span style="font-size:.82rem;font-weight:700;color:${dlColor}">${dl}</span></td>
        <td><span class="status-badge ${u.status==='active'?'sb-active':'sb-blocked'}">${u.status==='active'?'Активен':'Заблокирован'}</span></td>
        <td><div class="actions-cell">
          <button class="btn btn-warn btn-sm" onclick="openUserModal(${u.id})">✏️</button>
          <button class="btn btn-secondary btn-sm" onclick="toggleBlock(${u.id})">${u.status==='active'?'🔒':'🔓'}</button>
          <button class="btn btn-secondary btn-sm" onclick="sendReminder('${u.firstName}')">📨</button>
          <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">🗑️</button>
        </div></td>
      </tr>`;
    }).join('')||'<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--muted)">Нет консультантов</td></tr>'}</tbody>
  </table></div>`;
}

function refreshUsers(s,d,st) {
  const pg = document.getElementById('apage-adm-users');
  if(pg) pg.innerHTML = buildAdminUsers(s,d,st);
}

// ── Admin Catalog ──
function buildAdminCatalog() {
  return `<div class="view-header"><div><h2>📚 Каталог курсов</h2><p>Управление структурой курсов</p></div></div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
  ${DB_COURSES.map(c=>{
    const enrolled = DB_USERS.filter(u=>u.role==='user'&&hasAccess(u,c.id)).length;
    const[d,a]=(() => {let td=0,ta=0;DB_USERS.filter(u=>u.role==='user').forEach(u=>{const[dd,aa]=getCourseDone(u.id,c.id);td+=dd;ta+=aa;});return[td,ta];})();
    return `<div style="background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:18px;transition:all .2s">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div style="font-size:1.5rem">${c.icon}</div>
        <span class="status-badge ${c.status==='active'?'sb-active':c.status==='wip'?'sb-draft':'sb-blocked'}">${c.status==='active'?'Активен':c.status==='wip'?'В разработке':'Черновик'}</span>
      </div>
      <div style="font-size:.95rem;font-weight:700;color:var(--ink);margin-bottom:4px">${c.name}</div>
      <div style="font-size:.78rem;color:var(--muted);margin-bottom:12px">${c.desc.substring(0,80)}…</div>
      <div style="display:flex;gap:12px;font-size:.76rem;color:var(--muted);margin-bottom:12px">
        <span>📚 ${(c.modules||[]).length} модулей</span>
        <span>👥 ${enrolled} чел.</span>
        <span>📖 ${d}/${a} ур.</span>
      </div>
      <div style="display:flex;gap:7px">
        <button class="btn btn-secondary btn-sm" style="flex:1" onclick="editCourse(${c.id})">✏️ Редактировать</button>
        <button class="btn btn-primary btn-sm" style="flex:1" onclick="aTab('adm-content');selectCourseContent(${c.id})">📝 Контент</button>
      </div>
    </div>`;
  }).join('')}
  <div style="background:var(--mist);border:2px dashed var(--border);border-radius:var(--r);padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;min-height:180px" onclick="newCourse()">
    <div style="font-size:2rem;margin-bottom:8px">+</div>
    <div style="font-size:.88rem;font-weight:600;color:var(--muted)">Добавить курс</div>
  </div>
  </div>`;
}

// ── Admin Content ──
let selectedCourse=null, selectedModule=null;

function buildAdminContent() {
  return `<div class="view-header"><h2>✏️ Редактор контента</h2><p>Управление модулями и уроками</p></div>
  <div class="content-tree">
    <div class="tree-panel">
      <div class="tree-header">Курсы <button class="btn btn-primary btn-sm" onclick="newCourse()">+</button></div>
      ${DB_COURSES.map(c=>`
        <div class="tree-item ${selectedCourse===c.id&&!selectedModule?'active':''}" onclick="selectCourseContent(${c.id})">
          <span>${c.icon}</span><span style="flex:1">${c.name}</span>
          <span style="font-size:.7rem;color:var(--muted)">${(c.modules||[]).length}м</span>
        </div>
        ${selectedCourse===c.id?(c.modules||[]).sort((a,b)=>a.order-b.order).map(m=>`
          <div class="tree-item sub ${selectedModule===m.id?'active':''}" onclick="selectModuleContent(${c.id},${m.id})">
            <span>${m.icon}</span><span style="flex:1">${m.name}</span>
            <span style="font-size:.7rem;color:var(--muted)">${(m.lessons||[]).length}ур</span>
          </div>
          ${selectedModule===m.id?(m.lessons||[]).sort((a,b)=>a.order-b.order).map(l=>`
            <div class="tree-item sub2" onclick="editLesson(${c.id},${m.id},${l.id})">${typeLabel(l.type)} ${l.title}</div>
          `).join(''):''}
        `).join(''):''}
      `).join('')}
    </div>
    <div class="detail-panel" id="content-detail">
      ${selectedCourse?buildContentDetail():buildContentEmpty()}
    </div>
  </div>`;
}

function buildContentEmpty() { return `<div class="detail-empty"><div style="font-size:2rem;margin-bottom:12px">👈</div><div>Выберите курс или модуль для редактирования</div></div>`; }

function buildContentDetail() {
  if (!selectedCourse) return buildContentEmpty();
  const c=getCourse(selectedCourse);
  if (!c) return buildContentEmpty();

  if (selectedModule) {
    const m=getModule(selectedCourse, selectedModule);
    if (!m) return buildContentEmpty();
    return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div><h3>${m.icon} ${m.name}</h3><div style="font-size:.8rem;color:var(--muted)">${m.desc}</div></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-warn btn-sm" onclick="editModule(${c.id},${m.id})">✏️ Ред. модуль</button>
        <button class="btn btn-primary btn-sm" onclick="newLesson(${c.id},${m.id})">+ Урок</button>
        <button class="btn btn-danger btn-sm" onclick="deleteModule(${c.id},${m.id})">🗑️</button>
      </div>
    </div>
    <div>${(m.lessons||[]).sort((a,b)=>a.order-b.order).map(l=>`
      <div style="background:var(--mist);border:1px solid var(--border);border-radius:var(--rs);padding:13px 16px;margin-bottom:8px;display:flex;align-items:center;gap:11px">
        <span style="font-size:1rem">${typeLabel(l.type)}</span>
        <div style="flex:1"><div style="font-size:.88rem;font-weight:700">${l.title}</div>
        <div style="font-size:.74rem;color:var(--muted)">⏱️ ${l.dur}мин · ⭐ ${l.xp}XP · Порядок: ${l.order}</div></div>
        <button class="btn btn-warn btn-sm" onclick="editLesson(${c.id},${m.id},${l.id})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteLesson(${c.id},${m.id},${l.id})">🗑️</button>
      </div>`).join('')||'<div style="text-align:center;padding:30px;color:var(--muted)">Нет уроков</div>'}
    </div>`;
  }

  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div><h3>${c.icon} ${c.name}</h3><div style="font-size:.8rem;color:var(--muted)">${c.desc}</div></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-warn btn-sm" onclick="editCourse(${c.id})">✏️ Ред. курс</button>
      <button class="btn btn-primary btn-sm" onclick="newModule(${c.id})">+ Модуль</button>
    </div>
  </div>
  <div>${(c.modules||[]).sort((a,b)=>a.order-b.order).map(m=>`
    <div style="background:var(--mist);border:1px solid var(--border);border-radius:var(--rs);padding:13px 16px;margin-bottom:8px;display:flex;align-items:center;gap:11px;cursor:pointer" onclick="selectModuleContent(${c.id},${m.id})">
      <div style="width:36px;height:36px;border-radius:8px;background:${m.color}22;display:flex;align-items:center;justify-content:center;font-size:1rem">${m.icon}</div>
      <div style="flex:1"><div style="font-size:.88rem;font-weight:700">${m.name}</div>
      <div style="font-size:.74rem;color:var(--muted)">${(m.lessons||[]).length} уроков · Порядок: ${m.order}</div></div>
      <button class="btn btn-warn btn-sm" onclick="event.stopPropagation();editModule(${c.id},${m.id})">✏️</button>
      <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteModule(${c.id},${m.id})">🗑️</button>
    </div>`).join('')||'<div style="text-align:center;padding:30px;color:var(--muted)">Нет модулей</div>'}
  </div>`;
}

function selectCourseContent(cid) { selectedCourse=cid; selectedModule=null; aTab('adm-content'); }
function selectModuleContent(cid, mid) { selectedCourse=cid; selectedModule=mid; aTab('adm-content'); }

// ── Admin Results ──
function buildAdminResults(uF='',cF='',sF='') {
  let res=[...DB_RESULTS].sort((a,b)=>b.id-a.id);
  if(uF) res=res.filter(r=>r.userId===parseInt(uF));
  if(cF) res=res.filter(r=>r.courseId===parseInt(cF));
  if(sF==='pass') res=res.filter(r=>r.passed);
  if(sF==='fail') res=res.filter(r=>!r.passed);

  const uOpts=DB_USERS.filter(u=>u.role==='user').map(u=>`<option value="${u.id}"${parseInt(uF)===u.id?' selected':''}>${u.firstName} ${u.lastName}</option>`).join('');
  const cOpts=DB_COURSES.map(c=>`<option value="${c.id}"${parseInt(cF)===c.id?' selected':''}>${c.name}</option>`).join('');

  return `<div class="view-header"><div><h2>🎯 Результаты тестирования</h2></div><button class="btn btn-secondary" onclick="toast('Экспорт...')">⬇️ CSV</button></div>
  <div class="filter-bar">
    <select onchange="refreshResults(this.value,document.querySelectorAll('.filter-bar select')[1].value,document.querySelectorAll('.filter-bar select')[2].value)">
      <option value="">Все консультанты</option>${uOpts}
    </select>
    <select onchange="refreshResults(document.querySelectorAll('.filter-bar select')[0].value,this.value,document.querySelectorAll('.filter-bar select')[2].value)">
      <option value="">Все курсы</option>${cOpts}
    </select>
    <select onchange="refreshResults(document.querySelectorAll('.filter-bar select')[0].value,document.querySelectorAll('.filter-bar select')[1].value,this.value)">
      <option value="">Все</option><option value="pass"${sF==='pass'?' selected':''}>✅ Пройден</option><option value="fail"${sF==='fail'?' selected':''}>❌ Не пройден</option>
    </select>
  </div>
  <div class="table-wrap"><table class="adm-table">
    <thead><tr><th>Консультант</th><th>Курс</th><th>Результат</th><th>Дата</th><th>Статус</th></tr></thead>
    <tbody>${res.map(r=>{
      const u=getUser(r.userId);const c=getCourse(r.courseId);
      return `<tr><td><strong>${u?.firstName} ${u?.lastName}</strong><br/><span style="font-size:.7rem;color:var(--muted)">${u?.dept}</span></td>
        <td>${c?.icon} ${c?.name}</td><td><strong>${r.score}%</strong></td><td>${r.date}</td>
        <td><span class="status-badge ${r.passed?'sb-active':'sb-blocked'}">${r.passed?'✅ Пройден':'❌ Не пройден'}</span></td></tr>`;
    }).join('')||'<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--muted)">Нет данных</td></tr>'}</tbody>
  </table></div>`;
}
function refreshResults(u,c,s){const pg=document.getElementById('apage-adm-results');if(pg)pg.innerHTML=buildAdminResults(u,c,s);}

// ── Admin Analytics ──
function buildAdminAnalytics() {
  const depts=[...new Set(DB_USERS.filter(u=>u.role==='user').map(u=>u.dept))];
  return `<div class="view-header"><h2>📈 Аналитика</h2></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:20px">
      <div class="section-title">🏢 По подразделениям</div>
      ${depts.map(d=>{
        const du=DB_USERS.filter(u=>u.role==='user'&&u.dept===d);
        let td=0,ta=0;du.forEach(u=>{const[dd,aa]=(() => {let ddd=0,aaa=0;DB_COURSES.forEach(c=>{const[d2,a2]=getCourseDone(u.id,c.id);ddd+=d2;aaa+=a2;});return[ddd,aaa];})();td+=dd;ta+=aa;});
        const p=ta?Math.round(td/ta*100):0;
        return `<div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:.84rem;font-weight:600">${d}</span><span style="font-size:.82rem;font-weight:700;color:${p>=70?'var(--g)':p>=40?'var(--amber)':'var(--red)'}">${p}%</span></div>
          <div class="prog-bar"><div class="prog-fill" style="width:${p}%;background:${p>=70?'var(--g)':p>=40?'var(--amber)':'var(--red)'}"></div></div>
          <div style="font-size:.7rem;color:var(--muted);margin-top:2px">${du.length} чел.</div>
        </div>`;}).join('')}
    </div>
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:20px">
      <div class="section-title">📊 Эффективность курсов</div>
      ${DB_COURSES.filter(c=>c.status==='active').map(c=>{
        const res=DB_RESULTS.filter(r=>r.courseId===c.id);
        const avg=res.length?Math.round(res.reduce((s,r)=>s+r.score,0)/res.length):0;
        return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:11px">
          <span style="font-size:1rem;width:20px">${c.icon}</span>
          <div style="flex:1"><div style="font-size:.82rem;font-weight:600;margin-bottom:3px">${c.name}</div>
          <div class="prog-bar"><div class="prog-fill" style="width:${avg}%;background:${avg>=70?'var(--g)':'var(--amber)'}"></div></div></div>
          <span style="font-size:.84rem;font-weight:700;color:${avg>=70?'var(--g)':'var(--amber)'}${!res.length?';color:var(--muted)':''}">${res.length?avg+'%':'—'}</span>
        </div>`;}).join('')}
    </div>
  </div>`;
}

// ── Admin Assignments ──
function buildAdminAssign() {
  const d=new Date();d.setDate(d.getDate()+30);
  return `<div class="view-header"><div><h2>📋 Назначения</h2><p>Обязательные курсы и дедлайны</p></div>
    <button class="btn btn-primary" onclick="openAssignModal()">+ Назначить</button>
  </div>
  ${DB_ASSIGNMENTS.map(a=>{
    const d2=new Date(a.deadline);const days=Math.ceil((d2-new Date())/864e5);
    const dc=days<=3?'urgent':days<=7?'soon':'ok';
    return `<div class="assign-card">
      <div class="ac-icon">${a.priority==='mandatory'?'📋':'💡'}</div>
      <div class="ac-info">
        <div class="ac-title">${a.courseName} <span style="font-size:.7rem;background:${a.priority==='mandatory'?'#FEE2E2':'var(--gl)'};color:${a.priority==='mandatory'?'#7F1D1D':'var(--gd)'};padding:2px 7px;border-radius:8px;font-weight:700">${a.priority==='mandatory'?'ОБЯЗАТЕЛЬНО':'РЕКОМЕНДОВАНО'}</span></div>
        <div class="ac-meta">👥 ${a.targetLabel} · Создано: ${a.createdAt}</div>
      </div>
      <div><div class="ac-deadline ${dc}">⏰ ${new Date(a.deadline).toLocaleDateString('ru-KZ',{day:'2-digit',month:'short'})}</div>
      <div style="font-size:.72rem;color:var(--muted)">${days>0?days+' дн. осталось':'Просрочено'}</div></div>
      <button class="btn btn-danger btn-sm" onclick="DB_ASSIGNMENTS=DB_ASSIGNMENTS.filter(x=>x.id!==${a.id});dbSave();aTab('adm-assign')">✕</button>
    </div>`;
  }).join('')||'<div class="empty"><span>📭</span>Нет активных назначений</div>'}`;
}

// ══ CRUD MODALS ════════════════════════════════════

// User modal
function openUserModal(uid=null) {
  const u=uid?DB_USERS.find(x=>x.id===uid):null;
  document.getElementById('modal-user-h').textContent = u?'Редактировать консультанта':'Новый консультант';
  document.getElementById('mu-id').value = uid||'';
  document.getElementById('mu-first').value = u?.firstName||'';
  document.getElementById('mu-last').value  = u?.lastName||'';
  document.getElementById('mu-login').value = u?.login||'';
  document.getElementById('mu-pass').value  = u?.pass||'';
  document.getElementById('mu-email').value = u?.email||'';
  document.getElementById('mu-dept').value  = u?.dept||'Алматы — Офис 1';
  document.getElementById('mu-deadline').value = u?.deadline||(() => { const d=new Date();d.setDate(d.getDate()+30);return d.toISOString().slice(0,10); })();
  document.getElementById('mu-status').value = u?.status||'active';
  // Course checkboxes
  const courses = u?.courses==='all' ? DB_COURSES.map(c=>c.id) : (u?.courses||[]);
  document.getElementById('mu-courses').innerHTML = `
    <label class="check-item"><input type="checkbox" id="mu-all-courses" ${!u||u.courses==='all'?'checked':''} onchange="toggleAllCourses(this)"/> Все курсы</label>
    ${DB_COURSES.map(c=>`<label class="check-item"><input type="checkbox" name="mu-course" value="${c.id}" ${courses.includes(c.id)||(!u||u.courses==='all')?'checked':''}/> ${c.icon} ${c.name}</label>`).join('')}`;
  openModal('modal-user');
}

function toggleAllCourses(cb) {
  document.querySelectorAll('[name="mu-course"]').forEach(i=>i.checked=cb.checked);
}

function saveUser() {
  const id    = document.getElementById('mu-id').value;
  const first = document.getElementById('mu-first').value.trim();
  const last  = document.getElementById('mu-last').value.trim();
  const login = document.getElementById('mu-login').value.trim();
  const pass  = document.getElementById('mu-pass').value.trim();
  const email = document.getElementById('mu-email').value.trim();
  const dept  = document.getElementById('mu-dept').value;
  const dl    = document.getElementById('mu-deadline').value;
  const status= document.getElementById('mu-status').value;
  if (!first||!login||!pass) { toast('Заполните обязательные поля','error'); return; }
  if (DB_USERS.find(u=>u.login===login&&u.id!==parseInt(id))) { toast('Логин уже занят','error'); return; }
  const allCb = document.getElementById('mu-all-courses');
  const selected = allCb?.checked ? 'all' : [...document.querySelectorAll('[name="mu-course"]:checked')].map(i=>parseInt(i.value));
  const ini=(first[0]||'')+(last[0]||'');
  if (id) {
    const idx=DB_USERS.findIndex(u=>u.id===parseInt(id));
    DB_USERS[idx]={...DB_USERS[idx],firstName:first,lastName:last,login,pass,email,dept,deadline:dl,status,courses:selected,ini,avatar:ini};
  } else {
    DB_USERS.push({id:DB_IDS.user++,login,pass,role:'user',firstName:first,lastName:last,dept,email,status:'active',deadline:dl,courses:selected,avatar:ini});
  }
  dbSave(); closeModal(); aTab('adm-users');
  toast('Консультант сохранён ✓','success');
  if (selected!=='all') DB_NOTIFS.unshift({icon:'👤',text:`${first} ${last} — доступ к ${selected==='all'?'всем':selected.length} курсам`,time:'Только что'});
}

function toggleBlock(uid) {
  const u=DB_USERS.find(x=>x.id===uid);if(!u)return;
  u.status=u.status==='active'?'blocked':'active';
  dbSave();aTab('adm-users');
  toast(`${u.status==='active'?'✅ Разблокирован':'🔒 Заблокирован'}: ${u.firstName} ${u.lastName}`);
}

function deleteUser(uid) {
  if(!confirm('Удалить консультанта? Все данные прогресса будут удалены.'))return;
  DB_USERS=DB_USERS.filter(u=>u.id!==uid);
  DB_RESULTS=DB_RESULTS.filter(r=>r.userId!==uid);
  delete DB_PROGRESS[uid];
  dbSave();aTab('adm-users');toast('Консультант удалён');
}

function exportUsers() {
  const rows=[['Имя','Логин','Подразделение','Статус','Прогресс%']];
  DB_USERS.filter(u=>u.role==='user').forEach(u=>{
    let td=0,ta=0;DB_COURSES.forEach(c=>{const[d,a]=getCourseDone(u.id,c.id);td+=d;ta+=a;});
    rows.push([`${u.firstName} ${u.lastName}`,u.login,u.dept,u.status,ta?Math.round(td/ta*100):0]);
  });
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(rows.map(r=>r.join(',')).join('\n'));a.download='consultants.csv';a.click();
  toast('Экспорт выполнен','success');
}

// Course modal
function newCourse() {
  document.getElementById('modal-course-h').textContent='Новый курс';
  document.getElementById('mc-id').value='';
  ['mc-name','mc-desc'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('mc-icon').value='📚';
  document.getElementById('mc-cat').value='nsj';
  document.getElementById('mc-status').value='active';
  document.getElementById('mc-color').value='#00A651';
  openModal('modal-course');
}

function editCourse(cid) {
  const c=getCourse(cid);if(!c)return;
  document.getElementById('modal-course-h').textContent='Редактировать курс';
  document.getElementById('mc-id').value=c.id;
  document.getElementById('mc-name').value=c.name;
  document.getElementById('mc-icon').value=c.icon;
  document.getElementById('mc-desc').value=c.desc;
  document.getElementById('mc-cat').value=c.cat;
  document.getElementById('mc-status').value=c.status;
  document.getElementById('mc-color').value=c.color||'#00A651';
  openModal('modal-course');
}

function saveCourse() {
  const id=document.getElementById('mc-id').value;
  const name=document.getElementById('mc-name').value.trim();
  if(!name){toast('Введите название','error');return;}
  const data={name,icon:document.getElementById('mc-icon').value||'📚',desc:document.getElementById('mc-desc').value.trim(),cat:document.getElementById('mc-cat').value,status:document.getElementById('mc-status').value,color:document.getElementById('mc-color').value};
  if(id){const idx=DB_COURSES.findIndex(c=>c.id===parseInt(id));DB_COURSES[idx]={...DB_COURSES[idx],...data};}
  else DB_COURSES.push({id:DB_IDS.course++,...data,modules:[]});
  dbSave();closeModal();aTab('adm-catalog');toast('Курс сохранён ✓','success');
}

// Module modal
function newModule(cid) {
  document.getElementById('modal-module-h').textContent='Новый модуль';
  document.getElementById('mm-cid').value=cid;document.getElementById('mm-mid').value='';
  ['mm-name','mm-desc'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('mm-icon').value='📖';
  document.getElementById('mm-color').value='#00A651';
  document.getElementById('mm-order').value=((getCourse(cid)?.modules||[]).length+1);
  openModal('modal-module');
}

function editModule(cid, mid) {
  const m=getModule(cid,mid);if(!m)return;
  document.getElementById('modal-module-h').textContent='Редактировать модуль';
  document.getElementById('mm-cid').value=cid;document.getElementById('mm-mid').value=mid;
  document.getElementById('mm-name').value=m.name;
  document.getElementById('mm-desc').value=m.desc||'';
  document.getElementById('mm-icon').value=m.icon;
  document.getElementById('mm-color').value=m.color||'#00A651';
  document.getElementById('mm-order').value=m.order||1;
  openModal('modal-module');
}

function saveModule() {
  const cid=parseInt(document.getElementById('mm-cid').value);
  const mid=document.getElementById('mm-mid').value;
  const name=document.getElementById('mm-name').value.trim();
  if(!name){toast('Введите название','error');return;}
  const data={name,desc:document.getElementById('mm-desc').value.trim(),icon:document.getElementById('mm-icon').value||'📖',color:document.getElementById('mm-color').value,order:parseInt(document.getElementById('mm-order').value)||1};
  const c=getCourse(cid);if(!c)return;
  if(mid){const idx=c.modules.findIndex(m=>m.id===parseInt(mid));c.modules[idx]={...c.modules[idx],...data};}
  else c.modules.push({id:DB_IDS.module++,...data,lessons:[]});
  dbSave();closeModal();selectCourseContent(cid);aTab('adm-content');toast('Модуль сохранён ✓','success');
}

function deleteModule(cid, mid) {
  if(!confirm('Удалить модуль и все его уроки?'))return;
  const c=getCourse(cid);if(!c)return;
  c.modules=c.modules.filter(m=>m.id!==mid);
  selectedModule=null;
  dbSave();selectCourseContent(cid);aTab('adm-content');toast('Модуль удалён');
}

// Lesson modal
function newLesson(cid, mid) {
  document.getElementById('modal-lesson-h').textContent='Новый урок';
  document.getElementById('ml-cid').value=cid;document.getElementById('ml-mid').value=mid;document.getElementById('ml-lid').value='';
  ['ml-title','ml-intro','ml-text','ml-kp','ml-questions'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('ml-type').value='story';
  document.getElementById('ml-dur').value=5;document.getElementById('ml-xp').value=50;document.getElementById('ml-pts').value=40;
  document.getElementById('ml-order').value=((getModule(cid,mid)?.lessons||[]).length+1);
  toggleLessonFields();
  openModal('modal-lesson');
}

function editLesson(cid, mid, lid) {
  const l=getLesson(cid,mid,lid);if(!l)return;
  document.getElementById('modal-lesson-h').textContent='Редактировать урок';
  document.getElementById('ml-cid').value=cid;document.getElementById('ml-mid').value=mid;document.getElementById('ml-lid').value=lid;
  document.getElementById('ml-title').value=l.title;
  document.getElementById('ml-type').value=l.type;
  document.getElementById('ml-dur').value=l.dur||5;
  document.getElementById('ml-xp').value=l.xp||50;
  document.getElementById('ml-pts').value=l.pts||40;
  document.getElementById('ml-order').value=l.order||1;
  document.getElementById('ml-intro').value=l.intro||'';
  document.getElementById('ml-text').value=l.text||'';
  document.getElementById('ml-kp').value=(l.keyPoints||[]).map(k=>'• '+k).join('\n');
  document.getElementById('ml-questions').value=l.questions?JSON.stringify(l.questions,null,2):'';
  toggleLessonFields();
  openModal('modal-lesson');
}

function toggleLessonFields() {
  const t=document.getElementById('ml-type').value;
  document.getElementById('ml-story-area').style.display=t==='quiz'?'none':'block';
  document.getElementById('ml-quiz-area').style.display=t==='quiz'?'block':'none';
}

function saveLesson() {
  const cid=parseInt(document.getElementById('ml-cid').value);
  const mid=parseInt(document.getElementById('ml-mid').value);
  const lid=document.getElementById('ml-lid').value;
  const title=document.getElementById('ml-title').value.trim();
  if(!title){toast('Введите название урока','error');return;}
  const type=document.getElementById('ml-type').value;
  const kpRaw=document.getElementById('ml-kp').value.trim();
  const kp=kpRaw?kpRaw.split('\n').map(s=>s.replace(/^[•\-\*]\s*/,'').trim()).filter(Boolean):[];
  let qs=[];
  if(type==='quiz'){try{qs=JSON.parse(document.getElementById('ml-questions').value||'[]');}catch(e){toast('Ошибка в формате JSON вопросов','error');return;}}
  const data={title,type,dur:parseInt(document.getElementById('ml-dur').value)||5,xp:parseInt(document.getElementById('ml-xp').value)||50,pts:parseInt(document.getElementById('ml-pts').value)||40,order:parseInt(document.getElementById('ml-order').value)||1,intro:document.getElementById('ml-intro').value.trim(),text:document.getElementById('ml-text').value.trim(),keyPoints:kp,questions:qs,isQuiz:type==='quiz'};
  const m=getModule(cid,mid);if(!m)return;
  if(lid){const idx=m.lessons.findIndex(l=>l.id===parseInt(lid));m.lessons[idx]={...m.lessons[idx],...data};}
  else m.lessons.push({id:DB_IDS.lesson++,...data});
  dbSave();closeModal();selectModuleContent(cid,mid);aTab('adm-content');toast('Урок сохранён ✓','success');
}

function deleteLesson(cid, mid, lid) {
  if(!confirm('Удалить урок?'))return;
  const m=getModule(cid,mid);if(!m)return;
  m.lessons=m.lessons.filter(l=>l.id!==lid);
  dbSave();selectModuleContent(cid,mid);aTab('adm-content');toast('Урок удалён');
}

// Assignment modal
function openAssignModal() {
  const d=new Date();d.setDate(d.getDate()+30);
  document.getElementById('ass-deadline').value=d.toISOString().slice(0,10);
  document.getElementById('ass-course').innerHTML=DB_COURSES.filter(c=>c.status==='active').map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  openModal('modal-assign');
}

function saveAssignment() {
  const who=document.getElementById('ass-who').value;
  const dept=document.getElementById('ass-dept').value;
  const csel=document.getElementById('ass-course');
  const cid=parseInt(csel.value);
  const c=getCourse(cid);
  DB_ASSIGNMENTS.push({id:DB_IDS.assign++,target:who,targetLabel:who==='all'?'Все консультанты':dept,courseId:cid,courseName:c?.name||'—',deadline:document.getElementById('ass-deadline').value,priority:document.getElementById('ass-priority').value,createdAt:todayStr()});
  dbSave();closeModal();aTab('adm-assign');toast('Назначение создано ✓','success');
}

// ══ MODAL HELPERS ══════════════════════════════════
function openModal(id) {
  document.getElementById('modal-overlay').style.display='block';
  document.getElementById(id).style.display='block';
}
function closeModal() {
  document.getElementById('modal-overlay').style.display='none';
  document.querySelectorAll('.modal').forEach(m=>m.style.display='none');
}

// ══ NOTIFICATION ═══════════════════════════════════
function toggleNotif() {
  const p=document.getElementById('notif-panel');
  p.style.display=p.style.display==='none'?'block':'none';
  if(p.style.display==='block'){
    document.getElementById('notif-list').innerHTML=DB_NOTIFS.length
      ?DB_NOTIFS.map(n=>`<div class="notif-item"><div class="ni-icon">${n.icon}</div><div><div class="ni-text">${n.text}</div><div class="ni-time">${n.time}</div></div></div>`).join('')
      :'<div style="padding:16px;text-align:center;color:var(--muted)">Нет уведомлений</div>';
  }
}
function clearNotifs(){DB_NOTIFS=[];document.getElementById('notif-dot').style.display='none';toggleNotif();}

// ══ GENERIC HELPERS ════════════════════════════════
function toggleSide(id) { document.getElementById(id).classList.toggle('open'); }
function closeDropdowns() { document.querySelectorAll('.dropdown').forEach(d=>d.classList.remove('open')); }
function toggleDrop(id) {
  const el=document.getElementById(id);
  const was=el.classList.contains('open');
  closeDropdowns();
  if(!was)el.classList.add('open');
}
document.addEventListener('click', e=>{
  if(!e.target.closest('.user-chip'))closeDropdowns();
  if(!e.target.closest('.notif-btn')&&!e.target.closest('.notif-panel')){
    const p=document.getElementById('notif-panel');if(p)p.style.display='none';
  }
});

function sendReminder(name){toast(`📨 Напоминание отправлено: ${name}`,'success');DB_NOTIFS.unshift({icon:'📨',text:`Напоминание отправлено: ${name}`,time:'Только что'});document.getElementById('notif-dot').style.display='block';}

function toast(msg,type='info'){
  const t=document.createElement('div');
  t.className=`toast ${type}`;t.textContent=msg;
  document.getElementById('toast-wrap').appendChild(t);
  setTimeout(()=>t.remove(),3200);
}
