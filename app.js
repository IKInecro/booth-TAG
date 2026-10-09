// ponytail: neo brutalism light, ghost interaktif, grid rasio PNG, result samping, desktop-only
const $ = s => document.querySelector(s)
const views = {
  gate: $('#view-gate'),
  frames: $('#view-frames'),
  booth: $('#view-booth'),
  result: $('#view-result'),
}
const ghost = $('#ghost')
const mobileBlock = $('#mobile-block')
function isMobile(){ return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) }
function updateMobileBlock(){
  if(!mobileBlock) return
  const m = isMobile()
  mobileBlock.style.display = m ? 'grid' : 'none'
  // prevent interaction when mobile
  document.body.style.overflow = m ? 'hidden' : ''
}
window.addEventListener('resize', updateMobileBlock)
updateMobileBlock()

function show(k){
  if(isMobile() && k !== 'gate'){
    // tetap di gate + mobile block
    updateMobileBlock()
    return
  }
  Object.entries(views).forEach(([name,el])=> el.hidden = name!==k)
  // pindah ghost ke view aktif biar interaktif di semua halaman
  if(ghost){
    const target = views[k]
    if(target && !target.contains(ghost)){
      target.appendChild(ghost)
      ghost.style.left='12%'; ghost.style.top='18%'
    }
  }
  updateMobileBlock()
}
let stream=null
let frames=[]
let selected=null
let photosCanvases=[]
let activeCategory='all'
const CATS=[['all','Semua'],['strip-koran','Strip Koran (A4)'],['strip-kecil','Strip Kecil (100×148)']]
function groupCount(f){
  return f.captureGroups ? f.captureGroups.length : f.slots.length
}
function groupRects(f,k){
  if(!f.captureGroups) return [f.slots[k]]
  return f.captureGroups[k].map(i=>f.slots[i])
}
function groupOfSlot(f){
  if(!f.captureGroups) return f.slots.map((_,i)=>i)
  const g=new Array(f.slots.length)
  f.captureGroups.forEach((grp,k)=>grp.forEach(i=>{g[i]=k}))
  return g
}

const video=$('#video')
const videoWrap=$('#video-wrap')
const slotLayer=$('#slot-layer')
const framePreviewImg=$('#frame-preview-img')
const countdownEl=$('#countdown')
const flashEl=$('#flash')
const progressEl=$('#progress')
const boothHint=$('#booth-hint')
const boothTitle=$('#booth-title')
const boothStep=$('#booth-step')
const badgeText=$('#badge-text')
const btnCapture=$('#btn-capture')
const captureText=$('#capture-text')
const resultImg=$('#result-img')
const finalCanvas=$('#final-canvas')
const sndAll=new Audio('./sound/allbutton.wav'),sndCount=new Audio('./sound/countdown.mp3'),sndShoot=new Audio('./sound/camera_shoot.wav');[sndAll,sndCount,sndShoot].forEach(a=>a.preload='auto');const play=a=>{a.currentTime=0;a.play().catch(()=>{})};document.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.id!=='btn-capture')play(sndAll)})
let timerSec=3,autoShoot=false,curFilter='normal'
const filters={normal:'none',bw:'grayscale(1)',vintage:'sepia(.6) contrast(1.1) brightness(.9)',soft:'contrast(.9) brightness(1.05) saturate(1.1) blur(.4px)'}
function applyFilter(f){curFilter=f;video.style.filter=filters[f]||'none'}
document.querySelectorAll('.timer-btn').forEach(b=>b.onclick=()=>{
  timerSec=+b.dataset.timer||3
  document.querySelectorAll('.timer-btn').forEach(x=>{x.classList.toggle('neo-btn-primary',x===b);x.classList.toggle('neo-btn',x!==b)})
})
;(()=>{
  const a=document.getElementById('auto-shoot');if(a)a.onchange=e=>autoShoot=e.target.checked
  const fs=document.getElementById('filter-select');if(fs)fs.onchange=e=>applyFilter(e.target.value)
})()

$('#btn-allow').onclick = async ()=>{
  if(isMobile()){ updateMobileBlock(); return }
  const msg=$('#gate-msg')
  msg.hidden=true; msg.textContent=''
  try{
    const s = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user', width:{ideal:1280}, height:{ideal:720}}, audio:false})
    s.getTracks().forEach(t=>t.stop())
    stream=null
    show('frames')
  }catch(e){
    msg.hidden=false
    const name=e?.name||''
    if(name==='NotAllowedError' || name==='PermissionDeniedError'){
      msg.textContent='Akses ditolak.'
    }else if(name==='NotFoundError'){
      msg.textContent='Kamera tidak ditemukan.'
    }else{
      msg.textContent='Gagal buka kamera: '+(e.message||name)
    }
    $('#btn-allow').innerHTML='Coba Lagi <svg class="icon icon-sm"><use href="#i-camera"/></svg>'
  }
}
$('#btn-back-to-gate').onclick=()=> show('gate')

async function loadFrames(){
  const res = await fetch('./frames.json')
  frames = await res.json()
  renderChips()
  renderFrameGrid()
}
function renderChips(){
  const wrap=$('#category-chips')
  if(!wrap) return
  wrap.innerHTML=''
  CATS.forEach(([val,label])=>{
    const b=document.createElement('button')
    b.className='neo-btn chip'+(val===activeCategory?' active':'')
    b.textContent=label
    b.onclick=()=>{ activeCategory=val; renderChips(); renderFrameGrid() }
    wrap.appendChild(b)
  })
}
function renderFrameGrid(){
  const grid=$('#frame-grid')
  grid.innerHTML=''
  frames.filter(f=>activeCategory==='all'||f.category===activeCategory).forEach(f=>{
    const card=document.createElement('button')
    card.className='frame-card neo-card'
    card.style.display='flex'; card.style.flexDirection='column'; card.style.alignItems='center'
    const imgWrap=document.createElement('div')
    imgWrap.className='card-img-wrap'
    // container menyesuaikan ukuran isinya — tinggi sama 280, lebar ngikut rasio biar simetris
    const h = window.innerWidth <= 640 ? 240 : 280
    const r = f.w / f.h
    const w = Math.round(h * r)
    imgWrap.style.height = h + 'px'
    imgWrap.style.width = w + 'px'
    imgWrap.style.maxWidth = '100%'
    const img=document.createElement('img')
    img.src=f.src; img.alt=f.name; img.loading='lazy'
    imgWrap.appendChild(img)
    const meta=document.createElement('div')
    meta.style.marginTop='10px'; meta.style.width='100%'; meta.style.textAlign='center'
    const size = f.printSize ? ` · ${f.printSize}` : ''
    meta.innerHTML=`<b>${f.name}</b><br><span>${groupCount(f)} foto${size}</span><br><span class="size-badge">${f.category==='strip-koran'?'STRIP KORAN':f.category==='strip-kecil'?'STRIP KECIL':'FRAME'}</span>`
    card.appendChild(imgWrap); card.appendChild(meta)
    card.onclick=()=> selectFrame(f)
    grid.appendChild(card)
  })
}
function selectFrame(f){
  selected=f
  photosCanvases=[]
  boothTitle.textContent = f.name
  framePreviewImg.src = f.src
  const preview=$('#frame-preview')
  // fix: new1 600x2000 sangat tinggi vs new2 1080x1350 — pakai tinggi tetap simetris biar full visible no scroll, tidak nyatu kamera
  const r=f.w/f.h
  const targetH = window.innerWidth <= 860 ? 440 : 520
  // width dibatasi kolom 340px biar tidak nyatu kamera
  const maxW = 340
  let h = targetH
  let w = Math.round(h * r)
  if(w > maxW){ w = maxW; h = Math.round(w / r) }
  preview.style.height = h + 'px'
  preview.style.width = w + 'px'
  preview.style.maxWidth = '100%'
  preview.style.aspectRatio = 'auto'
  preview.style.margin = '0 auto'
  preview.style.display = 'grid'
  preview.style.placeItems = 'center'
  const ratio = groupRects(f,0)[0] ? (groupRects(f,0)[0].w / groupRects(f,0)[0].h) : 3/4
  videoWrap.style.aspectRatio = String(ratio)
  // cegah video-wrap nabrak preview di new2 diagonal
  videoWrap.style.maxWidth = '100%'
  buildSlots()
  renderProgress()
  show('booth')
  startCamera()
}
function buildSlots(){
  slotLayer.innerHTML=''
  if(!selected) return
  const W=selected.w, H=selected.h
  const gmap=groupOfSlot(selected)
  const cur=photosCanvases.length
  selected.slots.forEach((s, i)=>{
    const el=document.createElement('div')
    el.className='slot empty'
    el.dataset.idx=i
    el.style.left = (s.x / W * 100) + '%'
    el.style.top = (s.y / H * 100) + '%'
    el.style.width = (s.w / W * 100) + '%'
    el.style.height = (s.h / H * 100) + '%'
    const canvas = photosCanvases[gmap[i]]
    if(canvas){
      el.classList.remove('empty')
      el.classList.add('filled')
      const img=document.createElement('img')
      img.src = canvas.toDataURL('image/jpeg',0.85)
      el.appendChild(img)
    }else{
      const isActive = gmap[i]===cur
      if(isActive) el.classList.add('active')
      const span=document.createElement('span')
      span.textContent = isActive ? 'Slot '+(gmap[i]+1)+' siap' : 'Slot '+(gmap[i]+1)
      el.appendChild(span)
    }
    slotLayer.appendChild(el)
  })
}

$('#btn-change-frame').onclick=()=>{
  stopCamera()
  show('frames')
}
$('#btn-change-frame2').onclick=()=>{
  show('frames')
}
function renderProgress(){
  if(!selected) return
  const n=groupCount(selected)
  const cur=photosCanvases.length
  progressEl.innerHTML=''
  for(let i=0;i<n;i++){
    const d=document.createElement('div')
    d.className='dot'+(i<cur?' done':'')+(i===cur?' active':'')
    progressEl.appendChild(d)
  }
  boothStep.textContent = `${cur}/${n}`
  badgeText.textContent = cur>=n ? 'Selesai' : 'Slot '+(cur+1)+' dari '+n
  boothHint.textContent = cur>=n ? 'Strip penuh — lihat hasil' : ''
  captureText.textContent = cur>=n ? 'Lihat Hasil' : 'Ambil Foto'
  btnCapture.disabled = false
  $('#btn-retake').hidden = cur===0
  if(cur<n){
    const r=groupRects(selected,cur)[0]
    if(r) videoWrap.style.aspectRatio = String(r.w / r.h)
  }
  buildSlots()
}

async function startCamera(){
  try{
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user', width:{ideal:1280}, height:{ideal:720}}, audio:false})
    video.srcObject=stream
    await video.play()
  }catch(e){
    alert('Gagal nyalakan kamera: '+(e.message||e.name))
    show('gate')
  }
}
function stopCamera(){
  if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null }
  video.srcObject=null
}
function captureToCanvas(){
  const vw=video.videoWidth, vh=video.videoHeight
  if(!vw||!vh) return null
  const c=document.createElement('canvas')
  c.width=vw; c.height=vh
  const ctx=c.getContext('2d')
  ctx.filter=filters[curFilter]||'none'
  // mirror biar hasil sama kayak preview (video CSS mirrored)
  ctx.translate(vw,0); ctx.scale(-1,1)
  ctx.drawImage(video,0,0,vw,vh)
  return c
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function doCountdown(sec=timerSec){
  countdownEl.hidden=false
  for(let n=sec;n>=1;n--){
    countdownEl.textContent=n
    if(n===3) play(sndCount)
    await sleep(n<=3?1110:1000)
  }
  countdownEl.textContent=' '
  await sleep(220)
  countdownEl.hidden=true
}
function doFlash(){
  flashEl.hidden=false
  setTimeout(()=> flashEl.hidden=true, 280)
}
btnCapture.onclick = async ()=>{
  if(!selected) return
  if(photosCanvases.length>=groupCount(selected)){
    play(sndAll);await composeAndShow()
    return
  }
  btnCapture.disabled=true
  await doCountdown()
  const cap = captureToCanvas()
  if(!cap){ btnCapture.disabled=false; return }
  doFlash();play(sndShoot)
  photosCanvases.push(cap)
  renderProgress()
  btnCapture.disabled=false
  if(photosCanvases.length>=groupCount(selected)){
    await sleep(420)
    await composeAndShow()
  }else if(autoShoot){
    await sleep(900)
    if(autoShoot && photosCanvases.length < groupCount(selected)) btnCapture.click()
  }
}
$('#btn-retake').onclick=()=>{
  photosCanvases.pop()
  renderProgress()
}
async function composeAndShow(){
  if(!selected || photosCanvases.length===0) return
  const W=selected.w, H=selected.h
  finalCanvas.width=W; finalCanvas.height=H
  const ctx=finalCanvas.getContext('2d')
  ctx.fillStyle='#fff'
  ctx.fillRect(0,0,W,H)
  for(let k=0;k<photosCanvases.length;k++){
    for(const slot of groupRects(selected,k)){
      if(!slot) break
      drawCover(ctx, photosCanvases[k], slot.x, slot.y, slot.w, slot.h)
    }
  }
  const frameImg = await loadImage(selected.src)
  ctx.drawImage(frameImg,0,0,W,H)
  resultImg.src=finalCanvas.toDataURL('image/png')
  stopCamera()
  show('result')
}
function drawCover(ctx, src, dx, dy, dw, dh){
  const sw=src.width, sh=src.height
  const srcRatio=sw/sh, dstRatio=dw/dh
  let sx=0,sy=0,swCrop=sw,shCrop=sh
  if(srcRatio > dstRatio){
    swCrop = sh * dstRatio
    sx = (sw - swCrop)/2
  }else{
    shCrop = sw / dstRatio
    sy = (sh - shCrop)/2
  }
  ctx.drawImage(src, sx, sy, swCrop, shCrop, dx, dy, dw, dh)
}
function loadImage(src){
  return new Promise((res,rej)=>{
    const img=new Image()
    img.onload=()=>res(img)
    img.onerror=rej
    img.src=src
  })
}
$('#btn-download').onclick=()=>{
  const a=document.createElement('a')
  a.download=`photobooth-${selected?.id||'strip'}-${Date.now()}.png`
  a.href=finalCanvas.toDataURL('image/png')
  a.click()
}
$('#btn-restart').onclick=()=>{
  photosCanvases=[]
  resultImg.src=''
  renderProgress()
  show('booth')
  startCamera()
}
loadFrames()
show('gate')
// loader hide
;(()=>{function hide(){const l=document.getElementById('loader');if(l){l.classList.add('hide');setTimeout(()=>l.remove(),400)}}if(document.readyState==='complete')setTimeout(hide,800);else window.addEventListener('load',()=>setTimeout(hide,800))})()
// ghost wandering — interaktif di semua view
;(function(){
  if(!ghost) return
  const palette=['#22C55E','#0038FF','#FF4D8D','#FACC15','#EF4444']
  let last=-1
  setInterval(()=>{
    let i;do{i=Math.floor(Math.random()*palette.length)}while(i===last)
    last=i;ghost.style.setProperty('--ghost',palette[i])
  },600)
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  ghost.style.left='12%';ghost.style.top='18%'
  let lastX=0
  function wander(){
    const delay=1200+Math.random()*1800
    const dur=(0.9+Math.random()*0.9).toFixed(2)
    ghost.style.transition=`left ${dur}s ease, top ${dur}s ease, transform .25s ease`
    const parent=ghost.parentElement
    if(!parent){ setTimeout(wander,delay); return }
    const rect=parent.getBoundingClientRect()
    const gw=ghost.offsetWidth||140
    const gh=ghost.offsetHeight||140
    const maxX=Math.max(0,rect.width-gw-20)
    const maxY=Math.max(0,rect.height-gh-20)
    const x=Math.random()*maxX
    const y=Math.random()*maxY
    if(x>lastX) ghost.classList.add('facing-right')
    else ghost.classList.remove('facing-right')
    lastX=x
    ghost.style.left=x+'px'
    ghost.style.top=y+'px'
    setTimeout(wander,delay)
  }
  setTimeout(wander,900)
})()
