const toast = document.getElementById('toast');
let toastTimer;
function showToast(message){toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2600)}
const supabaseConfigured=Boolean(window.HADIR_SUPABASE_URL&&window.HADIR_SUPABASE_ANON_KEY);
const supabaseClient=window.HADIR_SUPABASE_URL&&window.HADIR_SUPABASE_ANON_KEY&&window.supabase?.createClient?window.supabase.createClient(window.HADIR_SUPABASE_URL,window.HADIR_SUPABASE_ANON_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}}):null;

const loginScreen=document.getElementById('loginScreen');
const appShell=document.querySelector('.app-shell');
const loginArt=document.querySelector('.login-art');
const schoolArtwork=document.createElement('img');schoolArtwork.className='login-school-image';schoolArtwork.src='GAMBAR-transparan.png';schoolArtwork.alt='SMA Negeri 1 Halmahera Timur — Absensi Murid';
loginArt.replaceChildren();
document.getElementById('loginScreen').insertBefore(schoolArtwork,document.querySelector('.login-panel'));
const loginForm=document.getElementById('loginForm');
const passwordLabel=document.createElement('label');passwordLabel.htmlFor='password';passwordLabel.textContent='Password';
const passwordWrap=document.createElement('div');passwordWrap.className='login-input-wrap';passwordWrap.innerHTML='<span class="input-user-icon">◈</span><input id="password" name="password" type="password" placeholder="Masukkan password" autocomplete="current-password" required>';
const loginButton=loginForm.querySelector('button[type="submit"]');loginForm.insertBefore(passwordLabel,loginButton);loginForm.insertBefore(passwordWrap,loginButton);
const loginFields=document.createElement('div');loginFields.className='login-fields';
const usernameField=document.createElement('div');usernameField.className='login-field';usernameField.append(loginForm.querySelector('label[for="username"]'),document.getElementById('username').parentElement);
const passwordField=document.createElement('div');passwordField.className='login-field';passwordField.append(passwordLabel,passwordWrap);
loginFields.append(usernameField,passwordField);loginForm.insertBefore(loginFields,loginButton);
document.getElementById('loginError').innerHTML='Username atau password salah. Periksa kembali data masuk Anda.';
document.querySelector('.login-hint')?.remove();
if(supabaseConfigured){loginForm.querySelector('label[for="username"]').textContent='Email Supabase';document.getElementById('username').placeholder='nama@sekolah.sch.id'}
let supabaseAuthReady=Promise.resolve();
if(supabaseClient){loginButton.disabled=true;loginButton.textContent='Menyiapkan login…';supabaseAuthReady=supabaseClient.auth.signOut({scope:'local'}).then(({error})=>{if(error)throw error}).catch(error=>showToast(`Sesi lama tidak dapat dibersihkan: ${error.message}`)).finally(()=>{loginButton.disabled=false;loginButton.textContent='Masuk ke Dashboard →'})}
let currentUser=null;
let authFlowGeneration=0;
let logoutLock=localStorage.getItem('hadir-logout')==='true';
window.hadirQrActive=localStorage.getItem('hadir-qr-active')==='true';
let qrCameraStream=null;
let activeSupabaseSessionId=null;
let teachersData=[];
const openedQrSession=(location.pathname.match(/^\/QR-(HADIR-\d{8})$/i)||[])[1]?.toUpperCase()||'';
function unlockDashboard(user){if(logoutLock)return;currentUser=user;loginScreen.hidden=true;appShell.classList.add('unlocked');if(!supabaseClient)sessionStorage.setItem('hadir-auth',JSON.stringify(user));applyRole();if(openedQrSession){showDashboard();renderPage('Absensi QR')}else showDashboard()}
// Selalu minta login manual setiap halaman dibuka; sesi lokal lama sudah dibersihkan di atas.
document.querySelector('.distribution-panel h2').textContent='Ringkasan Kehadiran';
document.querySelector('.distribution-panel .panel-heading p').textContent='Status kehadiran hari ini';
document.querySelector('.distribution-panel .donut-center').innerHTML='<strong>88,6%</strong><span>Kehadiran</span>';
document.querySelector('.attendance-panel h2').textContent='Tren Kehadiran';
document.querySelector('.attendance-panel .panel-heading p').textContent='Persentase kehadiran 7 hari terakhir';
document.querySelector('.activity-heading h2').textContent='Aktivitas Kehadiran Terbaru';
document.querySelector('.activity-heading p').textContent='Catatan kehadiran siswa hari ini';
loginForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const loginGeneration=++authFlowGeneration;
  logoutLock=false;
  localStorage.removeItem('hadir-logout');
  const username=document.getElementById('username').value.trim().toLowerCase();
  const password=document.getElementById('password').value;
  const error=document.getElementById('loginError');
if(supabaseConfigured&&!supabaseClient){error.textContent='Pustaka Supabase gagal dimuat. Periksa koneksi internet dan muat ulang halaman.';error.hidden=false;return}
if(supabaseClient){await supabaseAuthReady;if(loginGeneration!==authFlowGeneration)return;loginButton.disabled=true;loginButton.textContent='Menghubungkan…';const{data,error:authError}=await supabaseClient.auth.signInWithPassword({email:username,password});if(loginGeneration!==authFlowGeneration)return;if(authError){error.textContent='Email atau password Supabase salah, atau akun belum aktif.';error.hidden=false;loginButton.disabled=false;loginButton.textContent='Masuk ke Dashboard →';return}const{data:profile,error:profileError}=await supabaseClient.from('user_profiles').select('user_id,full_name,role,email,is_active').eq('user_id',data.user.id).maybeSingle();if(loginGeneration!==authFlowGeneration)return;if(profileError||!profile?.is_active){await supabaseClient.auth.signOut({scope:'local'});error.textContent='Profil akun tidak ditemukan atau dinonaktifkan. Minta administrator memeriksa user_profiles.';error.hidden=false;loginButton.disabled=false;loginButton.textContent='Masuk ke Dashboard →';return}try{await loadSupabaseData()}catch(loadError){if(loginGeneration===authFlowGeneration)await supabaseClient.auth.signOut({scope:'local'});if(loginGeneration!==authFlowGeneration)return;error.textContent=`Login berhasil, tetapi data Supabase gagal dimuat: ${loadError.message}`;error.hidden=false;loginButton.disabled=false;loginButton.textContent='Masuk ke Dashboard →';return}if(loginGeneration!==authFlowGeneration)return;error.hidden=true;loginButton.disabled=false;loginButton.textContent='Masuk ke Dashboard →';unlockDashboard({id:profile.user_id,username:profile.email||data.user.email,name:profile.full_name,email:profile.email||data.user.email,role:profile.role==='administrator'?'Administrator':'Guru Piket'});return}
  const account=accountData.find(user=>user.username.toLowerCase()===username&&user.password===password&&user.state==='Aktif');
  if(account){error.hidden=true;unlockDashboard({username:account.username,name:account.name,email:account.email,role:account.role})}
  else error.hidden=false;
});

const pageInfo={
  'Data Siswa':['Data Siswa','Kelola identitas siswa, kelas, dan status kehadiran.'],
  'Data Kelas':['Data Kelas','Atur rombongan belajar dan wali kelas.'],
  'Guru Piket':['Guru Piket','Susun jadwal petugas piket harian.'],
  'Akun Pengguna':['Akun Pengguna','Kelola akun dan peran pengguna aplikasi.'],
  'Ekspor Data':['Ekspor Data','Unduh data siswa dan absensi ke format CSV.'],
  'Pengaturan Absensi':['Pengaturan Absensi','Atur jam masuk, toleransi keterlambatan, dan hari sekolah.'],
  'Absensi QR':['Absensi QR','Buat sesi absensi QR untuk hari ini.'],
  'Laporan':['Laporan Kehadiran','Tinjau rekap kehadiran dan status siswa.'],
  'Impor Data':['Impor Data','Masukkan data siswa dari file CSV.']
};
const studentData=[
  {nis:'20241082',nisn:'0098123401',name:'Nadia Amalia',class:'XI IPA 1',gender:'Perempuan',birth:'2009-02-14',guardian:'Rahmawati',phone:'081234567801',address:'Maba, Halmahera Timur',status:'Hadir'},
  {nis:'20241056',nisn:'0098123402',name:'Rizky Firmansyah',class:'XI IPS 2',gender:'Laki-laki',birth:'2009-06-08',guardian:'Firman Yusuf',phone:'081234567802',address:'Buli, Halmahera Timur',status:'Hadir'},
  {nis:'20251124',nisn:'0099123403',name:'Aditya Pratama',class:'X IPA 3',gender:'Laki-laki',birth:'2010-01-22',guardian:'Suryani',phone:'081234567803',address:'Sagea, Halmahera Timur',status:'Terlambat'},
  {nis:'20230931',nisn:'0089123404',name:'Siti Aisyah',class:'XII IPA 1',gender:'Perempuan',birth:'2008-11-03',guardian:'Abdul Karim',phone:'081234567804',address:'Soagimalaha, Halmahera Timur',status:'Hadir'},
  {nis:'20241097',nisn:'0098123405',name:'Budi Wicaksono',class:'XI IPA 2',gender:'Laki-laki',birth:'2009-09-17',guardian:'Dewi Wicaksono',phone:'081234567805',address:'Maba, Halmahera Timur',status:'Izin'}
];
try{const savedStudents=JSON.parse(localStorage.getItem('hadir-students')||'null');if(Array.isArray(savedStudents)){const defaults=new Map(studentData.map(student=>[student.nis,student]));studentData.splice(0,studentData.length,...savedStudents.map(student=>({...defaults.get(student.nis),...student})))} }catch{}
const classData=[
  {name:'X IPA 1',level:'X',major:'IPA',teacher:'Dewi Kartika, S.Pd',room:'Ruang 10A',count:32,capacity:36,year:'2026/2027',status:'Aktif'},
  {name:'X IPA 2',level:'X',major:'IPA',teacher:'Rina Amelia, S.Pd',room:'Ruang 10B',count:31,capacity:36,year:'2026/2027',status:'Aktif'},
  {name:'X IPA 3',level:'X',major:'IPA',teacher:'Hendra Saputra, S.Pd',room:'Ruang 10C',count:33,capacity:36,year:'2026/2027',status:'Aktif'},
  {name:'XI IPA 1',level:'XI',major:'IPA',teacher:'Ratna Sari, S.Pd',room:'Ruang 11A',count:34,capacity:36,year:'2026/2027',status:'Aktif'},
  {name:'XI IPS 2',level:'XI',major:'IPS',teacher:'Agus Setiawan, S.Pd',room:'Ruang 11E',count:30,capacity:36,year:'2026/2027',status:'Aktif'},
  {name:'XII IPA 1',level:'XII',major:'IPA',teacher:'Lina Marlina, S.Pd',room:'Ruang 12A',count:32,capacity:36,year:'2026/2027',status:'Aktif'}
];
try{const savedClasses=JSON.parse(localStorage.getItem('hadir-classes')||'null');if(Array.isArray(savedClasses))classData.splice(0,classData.length,...savedClasses)}catch{}
const piketData=[
  {day:'Senin',teacher:'Dewi Kartika, S.Pd',area:'Gerbang utama',time:'06.30–07.30'},
  {day:'Selasa',teacher:'Agus Setiawan, S.Pd',area:'Gerbang utama',time:'06.30–07.30'},
  {day:'Rabu',teacher:'Ratna Sari, S.Pd',area:'Lobi sekolah',time:'06.30–07.30'},
  {day:'Kamis',teacher:'Hendra Saputra, S.Pd',area:'Gerbang utama',time:'06.30–07.30'},
  {day:'Jumat',teacher:'Lina Marlina, S.Pd',area:'Lapangan',time:'06.30–07.15'}
];
const accountData=[
];
try{const stored=JSON.parse(localStorage.getItem('hadir-accounts')||'null');if(Array.isArray(stored))accountData.splice(0,accountData.length,...stored)}catch{}
async function loadSupabaseData(){
  if(!supabaseClient)return;
  const date=new Date().toLocaleDateString('sv-SE');
  const results=await Promise.all([
    supabaseClient.from('classes').select('*').order('class_name'),
    supabaseClient.from('students').select('*').order('full_name'),
    supabaseClient.from('teachers').select('*').order('full_name'),
    supabaseClient.from('piket_schedules').select('*').eq('is_active',true),
    supabaseClient.from('attendance_records').select('*').eq('attendance_date',date),
    supabaseClient.from('user_profiles').select('user_id,full_name,role,email,is_active').eq('is_active',true),
    supabaseClient.from('school_settings').select('*').eq('id',1).maybeSingle(),
    supabaseClient.from('attendance_sessions').select('id,session_code,status').eq('session_date',date).eq('status','aktif').maybeSingle()
  ]);
  const [classesResult,studentsResult,teachersResult,schedulesResult,attendanceResult,profilesResult,settingsResult,sessionResult]=results;
  const queryError=results.find(result=>result.error)?.error;if(queryError){console.error('Supabase data load error:',queryError.message);throw queryError}
  const teachersById=new Map(teachersResult.data.map(t=>[t.id,t]));
  teachersData=teachersResult.data||[];
  classData.splice(0,classData.length,...classesResult.data.map(c=>({id:c.id,name:c.class_name,level:c.grade_level,major:c.major,teacher:teachersById.get(c.homeroom_teacher_id)?.full_name||'—',teacherId:c.homeroom_teacher_id,room:c.room_name||'—',count:0,capacity:c.capacity,year:c.academic_year,status:c.is_active?'Aktif':'Nonaktif'})));
  const classesById=new Map(classData.map(c=>[c.id,c]));
  for(const student of studentsResult.data){const cl=classesById.get(student.class_id);if(cl)cl.count++}
  const attendanceByStudent=new Map(attendanceResult.data.map(record=>[record.student_id,record]));
  const statusNames={hadir:'Hadir',terlambat:'Terlambat',izin:'Izin',sakit:'Sakit',alpa:'Alpa'};
  studentData.splice(0,studentData.length,...studentsResult.data.map(s=>{const record=attendanceByStudent.get(s.id);return{id:s.id,nis:s.nis,nisn:s.nisn||'',name:s.full_name,class:classesById.get(s.class_id)?.name||'—',classId:s.class_id,gender:s.gender==='laki_laki'?'Laki-laki':s.gender==='perempuan'?'Perempuan':'—',birth:s.date_of_birth||'',guardian:s.guardian_name||'',phone:s.guardian_phone||'',address:s.address||'',status:record?statusNames[record.status]||'Belum Absen':'Belum Absen',absentAt:record?new Date(record.scanned_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):''}}));
  piketData.splice(0,piketData.length,...schedulesResult.data.map(p=>({id:p.id,day:p.day_of_week,teacher:teachersById.get(p.teacher_id)?.full_name||'—',teacherId:p.teacher_id,area:p.duty_area,time:`${String(p.start_time).slice(0,5)}–${String(p.end_time).slice(0,5)}`})));
  accountData.splice(0,accountData.length,...profilesResult.data.map(profile=>({id:profile.user_id,username:profile.email||'',email:profile.email||'',name:profile.full_name,role:profile.role==='administrator'?'Administrator':'Guru Piket',state:'Aktif'})));
  activeSupabaseSessionId=sessionResult.data?.id||null;window.hadirQrActive=Boolean(activeSupabaseSessionId);
  const setting=settingsResult.data;if(setting){const values=JSON.parse(localStorage.getItem('hadir-settings')||'["06:30","07:00","15","","","100",true,true,false]');values[0]=String(setting.attendance_start).slice(0,5);values[1]=String(setting.on_time_until).slice(0,5);values[2]=String(setting.late_tolerance_minutes);values[3]=setting.location_latitude??'';values[4]=setting.location_longitude??'';values[5]=String(setting.attendance_radius_meters);values[6]=setting.qr_attendance_enabled;values[8]=setting.saturday_is_holiday;localStorage.setItem('hadir-settings',JSON.stringify(values))}
}
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function downloadCsv(filename,headers,rows){const csv=[headers,...rows].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportDataset(kind){
  if(kind==='students')return{filename:'data-siswa-sma-negeri-1-halmahera-timur.csv',headers:['NIS','NISN','Nama Lengkap','Kelas','Jenis Kelamin','Tanggal Lahir','Nama Orang Tua/Wali','No. HP Orang Tua/Wali','Alamat','Status Kehadiran'],rows:studentData.map(s=>[s.nis,s.nisn,s.name,s.class,s.gender,s.birth,s.guardian,s.phone,s.address,s.status])};
  if(kind==='classes')return{filename:'data-kelas-sma-negeri-1-halmahera-timur.csv',headers:['Nama Kelas','Tingkat','Jurusan','Nama Wali Kelas','Ruang Belajar','Jumlah Siswa','Kapasitas Kelas','Tahun Ajaran','Status Kelas'],rows:classData.map(c=>[c.name,c.level,c.major,c.teacher,c.room,c.count,c.capacity,c.year,c.status])};
  const date=new Date().toLocaleDateString('sv-SE');
  return{filename:`data-kehadiran-${date}.csv`,headers:['Tanggal','NIS','NISN','Nama Lengkap','Kelas','Jenis Kelamin','Jam Absen','Status Kehadiran'],rows:studentData.map(s=>[date,s.nis,s.nisn,s.name,s.class,s.gender,s.absentAt||'',s.status])};
}
async function copyDatasetToExcel(kind){const data=exportDataset(kind);const tsv=[data.headers,...data.rows].map(row=>row.map(value=>String(value??'').replaceAll('\t',' ').replaceAll('\r',' ').replaceAll('\n',' ')).join('\t')).join('\r\n');try{await navigator.clipboard.writeText(tsv)}catch{const textarea=document.createElement('textarea');textarea.value=tsv;textarea.style.position='fixed';textarea.style.opacity='0';document.body.appendChild(textarea);textarea.select();document.execCommand('copy');textarea.remove()}showToast(`${data.rows.length} baris disalin. Tempel langsung ke Excel.`)}
function createQrSvg(text){
  text=String(text).toUpperCase();const version=text.length<=25?1:2,size=17+4*version,dataCount=version===1?19:34,eccCount=version===1?7:10;
  const matrix=Array.from({length:size},()=>Array(size).fill(null));
  const put=(x,y,v)=>{if(x>=0&&x<size&&y>=0&&y<size)matrix[y][x]=!!v};
  const finder=(ox,oy)=>{for(let y=-1;y<=7;y++)for(let x=-1;x<=7;x++){const d=x>=0&&x<=6&&y>=0&&y<=6;put(ox+x,oy+y,d&&(x===0||x===6||y===0||y===6||(x>=2&&x<=4&&y>=2&&y<=4)))}};
  finder(0,0);finder(size-7,0);finder(0,size-7);
  for(let i=8;i<size-8;i++){put(i,6,i%2===0);put(6,i,i%2===0)}
  if(version===2)for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++)put(18+x,18+y,Math.max(Math.abs(x),Math.abs(y))===2||(x===0&&y===0));
  const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';let bits='0010'+text.length.toString(2).padStart(9,'0');
  for(let i=0;i<text.length;i+=2){if(i+1<text.length)bits+=(alphabet.indexOf(text[i])*45+alphabet.indexOf(text[i+1])).toString(2).padStart(11,'0');else bits+=alphabet.indexOf(text[i]).toString(2).padStart(6,'0')}
  bits+='0000';while(bits.length%8)bits+='0';let data=[];for(let i=0;i<bits.length;i+=8)data.push(parseInt(bits.slice(i,i+8),2));
  for(let pad=0;data.length<dataCount;pad++)data.push(pad%2?0x11:0xec);
  const mul=(x,y)=>{let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11d);if((y>>>i)&1)z^=x}return z};
  let gen=[1],root=1;for(let i=0;i<eccCount;i++){const next=Array(gen.length+1).fill(0);gen.forEach((v,j)=>{next[j]^=v;next[j+1]^=mul(v,root)});gen=next;root=mul(root,2)}
  let ecc=Array(eccCount).fill(0);for(const b of data){const factor=b^ecc[0];ecc.shift();ecc.push(0);for(let j=0;j<eccCount;j++)ecc[j]^=mul(gen[j+1],factor)}
  const codewords=[...data,...ecc];let bitIndex=0,up=true;
  for(let right=20;right>=1;right-=2){if(right===6)right--;for(let vert=0;vert<size;vert++){const y=up?size-1-vert:vert;for(let dx=0;dx<2;dx++){const x=right-dx;if(matrix[y][x]!==null)continue;let value=bitIndex<codewords.length*8?((codewords[bitIndex>>>3]>>>(7-(bitIndex&7)))&1):0;bitIndex++;if((x+y)%2===0)value^=1;put(x,y,value)}}up=!up}
  const formatData=8;let rem=formatData;for(let i=0;i<10;i++)rem=(rem<<1)^((rem>>>9)*0x537);const format=((formatData<<10)|rem)^0x5412;
  for(let i=0;i<=5;i++)put(8,i,(format>>>i)&1);put(8,7,(format>>>6)&1);put(8,8,(format>>>7)&1);put(7,8,(format>>>8)&1);for(let i=9;i<15;i++)put(14-i,8,(format>>>i)&1);
  for(let i=0;i<8;i++)put(size-1-i,8,(format>>>i)&1);for(let i=8;i<15;i++)put(8,size-15+i,(format>>>i)&1);put(8,size-8,true);
  const path=[];matrix.forEach((row,y)=>row.forEach((dark,x)=>{if(dark)path.push(`M${x} ${y}h1v1h-1z`)}));
  return `<svg viewBox="-4 -4 ${size+8} ${size+8}" role="img" aria-label="Kode QR sesi absensi"><rect x="-4" y="-4" width="${size+8}" height="${size+8}" fill="white"/><path d="${path.join('')}" fill="#18375b" shape-rendering="crispEdges"/></svg>`;
}
function stopQrCamera(){if(qrCameraStream){qrCameraStream.getTracks().forEach(track=>track.stop());qrCameraStream=null}const video=document.getElementById('qrVideo');if(video){video.pause();video.srcObject=null;video.hidden=true}const button=document.getElementById('scanQr');if(button)button.textContent='Buka Kamera Pemindai'}
async function recordQrAttendance(value){
  if(!window.hadirQrActive){showToast('Mulai sesi absensi QR terlebih dahulu');return}
  let nis=String(value||'').trim();try{const url=new URL(nis);nis=url.searchParams.get('nis')||nis}catch{}
  const student=studentData.find(item=>item.nis===nis);
  if(!student){showToast(`QR tidak dikenal: ${nis.slice(0,32)}`);return}
  const now=new Date(),date=now.toLocaleDateString('sv-SE'),settings=JSON.parse(localStorage.getItem('hadir-settings')||'[]'),cutoff=settings[1]||'07:00',time=now.toTimeString().slice(0,5),status=time>cutoff?'terlambat':'hadir';
  if(supabaseClient){if(!student.id){showToast('Siswa belum tersinkron ke Supabase. Muat ulang data dan coba lagi.');return}const{error}=await supabaseClient.from('attendance_records').upsert({session_id:activeSupabaseSessionId,student_id:student.id,attendance_date:date,status,source:'qr',scanned_at:now.toISOString(),marked_by:currentUser?.id||null},{onConflict:'student_id,attendance_date'});if(error){showToast(`Gagal menyimpan absensi: ${error.message}`);return}await loadSupabaseData();showToast(`${student.name} berhasil tercatat ${status==='hadir'?'hadir':'terlambat'}`);renderPage('Absensi QR');return}
  student.status=status==='hadir'?'Hadir':'Terlambat';student.absentAt=now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});localStorage.setItem('hadir-students',JSON.stringify(studentData));showToast(`${student.name} berhasil tercatat hadir`);renderPage('Absensi QR');
}
async function toggleSupabaseSession(){
  const date=new Date().toLocaleDateString('sv-SE');
  if(window.hadirQrActive&&activeSupabaseSessionId){const{error}=await supabaseClient.from('attendance_sessions').update({status:'selesai',ends_at:new Date().toISOString()}).eq('id',activeSupabaseSessionId);if(error)throw error;activeSupabaseSessionId=null;window.hadirQrActive=false;return}
  const code=`HADIR-${date.replaceAll('-','')}`;let{data,error}=await supabaseClient.from('attendance_sessions').select('id').eq('session_code',code).maybeSingle();if(error)throw error;
  if(data){const result=await supabaseClient.from('attendance_sessions').update({status:'aktif',session_date:date,starts_at:new Date().toISOString(),ends_at:null,created_by:currentUser?.id||null}).eq('id',data.id).select('id').single();if(result.error)throw result.error;activeSupabaseSessionId=result.data.id}
  else{const result=await supabaseClient.from('attendance_sessions').insert({session_code:code,session_date:date,title:'Absensi Siswa',status:'aktif',created_by:currentUser?.id||null}).select('id').single();if(result.error)throw result.error;activeSupabaseSessionId=result.data.id}
  window.hadirQrActive=true;
}
async function startQrCamera(){
  const video=document.getElementById('qrVideo');if(!video)return;
  if(qrCameraStream){stopQrCamera();return}
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){showToast('Browser memblokir kamera. Buka aplikasi di komputer melalui http://localhost:8000 atau gunakan HTTPS.');return}
  try{
    qrCameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},audio:false});video.srcObject=qrCameraStream;video.muted=true;video.playsInline=true;video.hidden=false;await video.play();
    const button=document.getElementById('scanQr');if(button)button.textContent='Tutup Kamera';
    const track=qrCameraStream.getVideoTracks()[0],capabilities=track.getCapabilities?.();if(capabilities?.focusMode?.includes('continuous'))track.applyConstraints({advanced:[{focusMode:'continuous'}]}).catch(()=>{});if(capabilities?.zoom){const zoom=Math.min(capabilities.zoom.max,1.5);if(zoom>capabilities.zoom.min)track.applyConstraints({advanced:[{zoom}]}).catch(()=>{})}
    if(!('BarcodeDetector'in window)){showToast('Kamera aktif. Browser belum mendukung dekoder QR; gunakan input NIS manual atau Chrome/Edge terbaru.');return}
    let detector;try{const supported=await BarcodeDetector.getSupportedFormats?.();const wanted=['qr_code','code_128','code_39','ean_13','ean_8','itf','upc_a','upc_e'];const formats=supported?wanted.filter(format=>supported.includes(format)):['qr_code'];if(!formats.length)throw new Error('barcode formats unsupported');detector=new BarcodeDetector({formats})}catch{showToast('Kamera aktif, tetapi dekoder barcode tidak tersedia pada browser ini. Gunakan input NIS manual.');return}
    const scan=async()=>{if(!qrCameraStream)return;try{if(video.readyState>=2){const codes=await detector.detect(video);if(codes.length){const scanned=codes[0].rawValue;stopQrCamera();recordQrAttendance(scanned);return}}}catch{}setTimeout(scan,80)};scan();
  }catch(error){stopQrCamera();const message=error?.name==='NotAllowedError'?'Izin kamera ditolak. Aktifkan izin kamera untuk situs ini dari ikon gembok di bilah alamat.':error?.name==='NotFoundError'?'Kamera tidak ditemukan pada perangkat ini.':error?.name==='NotReadableError'?'Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.':'Kamera tidak dapat dibuka. Gunakan localhost atau HTTPS, lalu izinkan akses kamera.';showToast(message)}
}
function tableMarkup(headers,rows){return `<div class="module-table-scroll"><table class="module-table"><thead><tr>${headers.map(x=>`<th>${h(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((x,i)=>`<td>${i===row.length-1&&['Hadir','Aktif','Terlambat','Izin','Sakit','Alpa','Belum Absen'].includes(x)?`<span class="module-status status-${x.toLowerCase().replaceAll(' ','-')}">${h(x)}</span>`:h(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
function pageFrame(page,body,action=''){const [title,desc]=pageInfo[page];return `<div class="module-heading"><div><div class="module-kicker">MENU SEKOLAH</div><h2>${h(title)}</h2><p>${h(desc)}</p></div>${action}</div>${body}`}
function applyRole(){
  if(!currentUser)return;
  const piketAllowed=['Dashboard','Data Siswa','Guru Piket','Absensi QR','Laporan'];
  document.querySelectorAll('.nav-item[data-page]').forEach(item=>{item.hidden=currentUser.role!=='Administrator'&&!piketAllowed.includes(item.dataset.page)});
  const profile=document.querySelector('.sidebar-profile>span:nth-child(2)');
  document.querySelector('.sidebar-profile .profile-avatar').textContent=(currentUser.name||'U').trim().slice(0,1).toUpperCase();
  profile.replaceChildren();const email=document.createElement('b');email.textContent=currentUser.email||currentUser.username;const role=document.createElement('small');role.textContent=currentUser.role;profile.append(email,role);
}
function renderPage(page){
  if(currentUser?.role!=='Administrator'&&!['Dashboard','Data Siswa','Guru Piket','Absensi QR','Laporan'].includes(page)){showToast('Menu ini hanya tersedia untuk Administrator');showDashboard();return}
  const view=document.getElementById('moduleView');let body='',action='';
  if(page==='Data Siswa'){
    action=`<div class="module-heading-actions"><button class="module-btn secondary" data-action="student-qr-cards">▦ Kartu QR</button>${currentUser?.role==='Administrator'?'<button class="module-btn primary" data-action="add-student">＋ Tambah Siswa</button>':''}</div>`;
    const activeStudents=studentData.filter(s=>s.status!=='Nonaktif').length;const boys=studentData.filter(s=>s.gender==='Laki-laki').length;const girls=studentData.filter(s=>s.gender==='Perempuan').length;
    body=`<div class="detail-stats"><div><span>Total terdata</span><b>${studentData.length}</b><small>Semua tingkat</small></div><div><span>Siswa aktif</span><b>${activeStudents}</b><small>Terdaftar</small></div><div><span>Laki-laki</span><b>${boys}</b><small>Siswa</small></div><div><span>Perempuan</span><b>${girls}</b><small>Siswa</small></div></div><div class="module-toolbar"><label class="module-search">⌕ <input id="moduleSearch" placeholder="Cari nama, NIS, NISN, atau wali..."></label><label class="module-select">Kelas <select id="classFilter"><option value="">Semua kelas</option>${[...new Set(classData.map(c=>c.name))].map(c=>`<option>${h(c)}</option>`).join('')}</select></label><label class="module-select">Jenis kelamin <select id="genderFilter"><option value="">Semua</option><option>Perempuan</option><option>Laki-laki</option></select></label><span class="module-count">${studentData.length} data siswa</span></div>${tableMarkup(['NIS','NISN','Nama Siswa','Kelas','Jenis Kelamin','Tanggal Lahir','Nama Wali','Kontak Wali','Alamat','Status'],studentData.map(s=>[s.nis,s.nisn||'—',s.name,s.class,s.gender,s.birth||'—',s.guardian||'—',s.phone||'—',s.address||'—',s.status]))}`;
  }else if(page==='Data Kelas'){
    action='<button class="module-btn primary" data-action="add-class">＋ Tambah Kelas</button>';
    const totalCapacity=classData.reduce((sum,c)=>sum+Number(c.capacity||0),0),totalMembers=classData.reduce((sum,c)=>sum+Number(c.count||0),0);
    body=`<div class="detail-stats"><div><span>Rombongan belajar</span><b>${classData.length}</b><small>Kelas terdata</small></div><div><span>Total siswa</span><b>${totalMembers}</b><small>Anggota kelas</small></div><div><span>Kapasitas tersedia</span><b>${totalCapacity-totalMembers}</b><small>Kursi tersisa</small></div><div><span>Tahun ajaran</span><b>2026/27</b><small>Berjalan</small></div></div><div class="module-toolbar"><label class="module-search">⌕ <input id="moduleSearch" placeholder="Cari nama kelas, wali kelas, atau ruang..."></label><label class="module-select">Tingkat <select id="levelFilter"><option value="">Semua tingkat</option><option>X</option><option>XI</option><option>XII</option></select></label><span class="module-count">${classData.length} kelas ditampilkan</span></div>${tableMarkup(['Nama Kelas','Tingkat','Jurusan','Wali Kelas','Ruang Belajar','Jumlah Siswa','Kapasitas','Tahun Ajaran','Status'],classData.map(c=>[c.name,c.level,c.major,c.teacher,c.room||'—',c.count,c.capacity||'—',c.year||'2026/2027',c.status||'Aktif']))}`;
  }else if(page==='Guru Piket'){
    action=currentUser?.role==='Administrator'?'<button class="module-btn primary" data-action="add-piket">＋ Atur Jadwal</button>':'';
    body=`<div class="module-callout"><b>Jadwal pekan ini</b><span>Petugas hadir 15 menit sebelum gerbang dibuka.</span></div>${tableMarkup(['Hari','Guru Piket','Lokasi Tugas','Jam Piket','Status'],piketData.map(p=>[p.day,p.teacher,p.area,p.time,'Aktif']))}`;
  }else if(page==='Akun Pengguna'){
    action='<button class="module-btn primary" data-action="add-account">＋ Tambah Pengguna</button>';
    body=`<div class="module-toolbar"><label class="module-search">⌕ <input id="moduleSearch" placeholder="Cari nama atau email..."></label><span class="module-count">${accountData.length} akun terdaftar</span></div>${tableMarkup(['Nama Pengguna','Email','Peran','Status','Aksi'],accountData.map(a=>[a.name,a.email,a.role,a.state,'•••']))}`;
  }else if(page==='Ekspor Data'){
    body=`<div class="export-note"><b>Format siap untuk Excel</b><span>Baris pertama berisi nama kolom. File CSV memakai pemisah titik koma dan encoding UTF-8. Tombol salin menghasilkan tab agar bisa langsung ditempel ke lembar Excel.</span></div><div class="export-grid"><article class="export-card"><span class="export-icon">♙</span><h3>Data Siswa</h3><p>Kolom: NIS, NISN, nama, kelas, jenis kelamin, tanggal lahir, wali, kontak, alamat, status.</p><div class="export-actions"><button class="module-btn primary" data-export="students">Unduh CSV untuk Excel ↓</button><button class="module-btn secondary" data-copy="students">Salin untuk Excel</button></div></article><article class="export-card"><span class="export-icon gold">▦</span><h3>Data Kehadiran</h3><p>Kolom: tanggal, NIS/NISN, nama, kelas, jenis kelamin, jam absen, dan status.</p><div class="export-actions"><button class="module-btn primary" data-export="attendance">Unduh CSV untuk Excel ↓</button><button class="module-btn secondary" data-copy="attendance">Salin untuk Excel</button></div></article><article class="export-card"><span class="export-icon purple">▤</span><h3>Data Kelas</h3><p>Kolom: nama kelas, tingkat, jurusan, wali kelas, ruang, jumlah siswa, kapasitas, tahun ajaran, dan status.</p><div class="export-actions"><button class="module-btn primary" data-export="classes">Unduh CSV untuk Excel ↓</button><button class="module-btn secondary" data-copy="classes">Salin untuk Excel</button></div></article></div>`;
  }else if(page==='Pengaturan Absensi'){
    body=`<form class="settings-form" id="settingsForm"><div class="settings-section"><h3>Jam Kehadiran</h3><p>Atur batas jam masuk dan toleransi keterlambatan.</p><div class="settings-fields"><label>Jam mulai absensi<input type="time" value="06:30"></label><label>Batas hadir tepat waktu<input type="time" value="07:00"></label><label>Toleransi terlambat (menit)<input type="number" value="15" min="0"></label></div></div><div class="settings-section"><h3>Titik Lokasi Sekolah</h3><p>Tentukan titik pusat validasi kehadiran. Izinkan akses lokasi browser untuk mengisi koordinat otomatis.</p><div class="location-fields"><label>Lintang (latitude)<input id="schoolLatitude" type="number" step="any" min="-90" max="90" placeholder="Contoh: 0.635000"></label><label>Bujur (longitude)<input id="schoolLongitude" type="number" step="any" min="-180" max="180" placeholder="Contoh: 127.500000"></label><label>Radius absensi (meter)<input id="schoolRadius" type="number" min="10" max="5000" step="10" value="100" required></label><button type="button" class="module-btn secondary location-button" id="getSchoolLocation">⌖ Ambil lokasi perangkat</button></div><div class="location-hint" id="locationHint">Radius menentukan jarak maksimum siswa dari titik sekolah untuk validasi lokasi.</div></div><div class="settings-section"><h3>Status Absensi</h3><div class="toggle-row"><span><b>Aktifkan absensi QR</b><small>Siswa dapat melakukan absensi melalui QR.</small></span><input type="checkbox" checked></div><div class="toggle-row"><span><b>Catat keterlambatan</b><small>Tandai siswa yang absen setelah batas waktu.</small></span><input type="checkbox" checked></div><div class="toggle-row"><span><b>Hari Sabtu libur</b><small>Jadwal sekolah berlangsung Senin sampai Jumat.</small></span><input type="checkbox"></div></div><div class="settings-footer"><span>Perubahan hanya tersimpan pada perangkat ini.</span><button class="module-btn primary">Simpan Pengaturan</button></div></form>`;
  }else if(page==='Absensi QR'){
    body=`<div class="qr-layout"><article class="qr-session-card"><div class="qr-live"><i></i> SESI ABSENSI ${window.hadirQrActive?'AKTIF':'BELUM DIMULAI'}</div><h3>Absensi Siswa</h3><p>Mulai sesi, lalu tampilkan QR ini agar siswa dapat memindainya.</p><div class="qr-code" id="qrCode" aria-label="Kode QR sesi absensi"></div><div class="qr-session-id">KODE SESI <b id="sessionCode">HADIR-${new Date().toISOString().slice(0,10).replaceAll('-','')}</b></div><button class="module-btn primary wide" id="startQr">${window.hadirQrActive?'Akhiri Sesi':'Mulai Sesi Absensi'}</button></article><article class="qr-info-card"><h3>Pemindai QR Siswa</h3><p class="qr-scan-help">Gunakan kamera untuk membaca QR atau barcode siswa yang berisi NIS, atau masukkan NIS secara manual.</p><video id="qrVideo" class="qr-video" playsinline hidden></video><div class="qr-camera-tip">Dekatkan kartu ke kamera dan pastikan kode terlihat jelas di layar.</div><button type="button" class="module-btn secondary wide" id="scanQr">Buka Kamera Pemindai</button><form class="qr-manual-form" id="qrManualForm"><label for="qrNis">NIS siswa</label><div><input id="qrNis" autocomplete="off" placeholder="Contoh: 20241082" required><button class="module-btn primary" type="submit">Catat Hadir</button></div></form><div class="module-callout"><b>Status</b><span>${window.hadirQrActive?'Sesi aktif. Absensi QR siap digunakan.':'Mulai sesi absensi terlebih dahulu untuk mencatat kehadiran.'}</span></div></article></div>`;
  }else if(page==='Laporan'){
    action='<button class="module-btn secondary" data-export="attendance">Unduh Laporan ↓</button>';
    body=`<div class="report-stats"><div><span>Total Siswa</span><b>1.248</b></div><div><span>Hadir</span><b>1.106 <small>88,6%</small></b></div><div><span>Izin / Sakit</span><b>86 <small>6,9%</small></b></div><div><span>Alpa</span><b>56 <small>4,5%</small></b></div></div><div class="module-toolbar"><label class="module-select">Tanggal <input type="date" value="2026-10-20"></label><label class="module-select">Kelas <select><option>Semua Kelas</option>${classData.map(c=>`<option>${h(c.name)}</option>`).join('')}</select></label></div>${tableMarkup(['Nama Siswa','NIS','Kelas','Jam Absen','Status'],studentData.map(s=>[s.name,s.nis,s.class,s.status==='Izin'?'—':'07:02 WIB',s.status]))}`;
  }else if(page==='Impor Data'){
    body=`<div class="import-card"><div class="import-icon">⇧</div><h3>Impor daftar siswa</h3><p>Pilih file CSV dengan kolom <b>NIS, Nama, Kelas, Jenis Kelamin</b>. Baris pertama digunakan sebagai judul kolom.</p><label class="file-picker">Pilih file CSV<input id="importFile" type="file" accept=".csv,text/csv"></label><div id="importPreview" class="import-preview">Belum ada file yang dipilih.</div><button id="importApply" class="module-btn primary" disabled>Impor Data</button></div>`;
  }
  view.innerHTML=pageFrame(page,body,action);view.hidden=false;document.getElementById('dashboardView').hidden=true;appShell.classList.remove('dashboard-active');if(page==='Absensi QR'){const code=document.getElementById('sessionCode').textContent;const base=(window.HADIR_BASE_URL||window.location.origin).replace(/\/$/,'');const sessionUrl=`${base}/QR-${code}`;document.getElementById('qrCode').innerHTML=createQrSvg(sessionUrl);const openLink=document.createElement('a');openLink.className='qr-open-link';openLink.href=sessionUrl;openLink.target='_blank';openLink.rel='noopener';openLink.textContent='Buka Absensi QR di Browser ↗';document.getElementById('qrCode').after(openLink)}
  bindModuleActions(page);
}
function showDashboard(){document.getElementById('moduleView').hidden=true;document.getElementById('dashboardView').hidden=false;appShell.classList.add('dashboard-active');document.querySelectorAll('.nav-item').forEach(item=>item.classList.toggle('active',item.dataset.page==='Dashboard'))}
async function logoutApplication(){logoutLock=true;localStorage.setItem('hadir-logout','true');++authFlowGeneration;if(supabaseClient){const{error}=await supabaseClient.auth.signOut({scope:'local'});if(error)showToast(`Sesi lokal dihapus, tetapi Supabase memberi peringatan: ${error.message}`)}sessionStorage.removeItem('hadir-auth');currentUser=null;activeSupabaseSessionId=null;window.hadirQrActive=false;appShell.classList.remove('unlocked');loginScreen.hidden=false;document.getElementById('username').value='';document.getElementById('password').value='';document.getElementById('loginError').hidden=true;document.querySelectorAll('.nav-item').forEach(item=>item.hidden=false)}
function bindModuleActions(page){
  const search=document.getElementById('moduleSearch');if(search)search.addEventListener('input',()=>{const q=search.value.toLowerCase();document.querySelectorAll('.module-table tbody tr').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(q))});
  const filter=document.getElementById('classFilter');if(filter)filter.addEventListener('change',()=>document.querySelectorAll('.module-table tbody tr').forEach(row=>row.hidden=!!filter.value&&!row.cells[3].textContent.includes(filter.value)));
  const genderFilter=document.getElementById('genderFilter');if(genderFilter)genderFilter.addEventListener('change',()=>document.querySelectorAll('.module-table tbody tr').forEach(row=>row.hidden=!!genderFilter.value&&!row.cells[4].textContent.includes(genderFilter.value)));
  const levelFilter=document.getElementById('levelFilter');if(levelFilter)levelFilter.addEventListener('change',()=>document.querySelectorAll('.module-table tbody tr').forEach(row=>row.hidden=!!levelFilter.value&&!row.cells[1].textContent.includes(levelFilter.value)));
  document.querySelectorAll('[data-export]').forEach(btn=>btn.addEventListener('click',()=>{const data=exportDataset(btn.dataset.export);downloadCsv(data.filename,data.headers,data.rows);showToast('File Excel CSV berhasil dibuat')}));
  document.querySelectorAll('[data-copy]').forEach(btn=>btn.addEventListener('click',()=>copyDatasetToExcel(btn.dataset.copy)));
  document.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>btn.dataset.action==='student-qr-cards'?openStudentQrCards():openAddForm(btn.dataset.action)));
  const settings=document.getElementById('settingsForm');if(settings){const inputs=Array.from(settings.querySelectorAll('input'));const saved=JSON.parse(localStorage.getItem('hadir-settings')||'null');if(Array.isArray(saved))inputs.forEach((input,i)=>{let index=i;if(saved.length===6&&inputs.length===9){if(i>=3&&i<=5)return;if(i>=6)index=i-3}if(saved[index]!==undefined){if(input.type==='checkbox')input.checked=saved[index];else input.value=saved[index]}});const locationButton=document.getElementById('getSchoolLocation');if(locationButton)locationButton.addEventListener('click',()=>{if(!navigator.geolocation){showToast('Browser tidak mendukung akses lokasi');return}locationButton.disabled=true;locationButton.textContent='Mengambil lokasi…';navigator.geolocation.getCurrentPosition(position=>{document.getElementById('schoolLatitude').value=position.coords.latitude.toFixed(6);document.getElementById('schoolLongitude').value=position.coords.longitude.toFixed(6);const hint=document.getElementById('locationHint');hint.textContent=`Lokasi didapat dengan akurasi sekitar ${Math.round(position.coords.accuracy)} meter.`;locationButton.disabled=false;locationButton.textContent='⌖ Ambil ulang lokasi';showToast('Koordinat lokasi perangkat terisi')},error=>{locationButton.disabled=false;locationButton.textContent='⌖ Ambil lokasi perangkat';showToast(error.code===1?'Izin lokasi ditolak. Izinkan akses lokasi di browser.':error.code===2?'Lokasi perangkat tidak tersedia. Coba isi koordinat secara manual.':'Waktu pengambilan lokasi habis. Coba lagi.')},{enableHighAccuracy:true,timeout:15000,maximumAge:0})});settings.addEventListener('submit',async e=>{e.preventDefault();const lat=document.getElementById('schoolLatitude').value,lon=document.getElementById('schoolLongitude').value;if(Boolean(lat)!==Boolean(lon)){showToast('Isi koordinat lintang dan bujur secara berpasangan');return}const values=inputs.map(input=>input.type==='checkbox'?input.checked:input.value);if(supabaseClient){const{error}=await supabaseClient.from('school_settings').upsert({id:1,attendance_start:values[0],on_time_until:values[1],late_tolerance_minutes:Number(values[2]),location_latitude:lat?Number(lat):null,location_longitude:lon?Number(lon):null,attendance_radius_meters:Number(values[5]),qr_attendance_enabled:values[6],saturday_is_holiday:values[8],updated_by:currentUser?.id||null},{onConflict:'id'});if(error){showToast(`Gagal menyimpan pengaturan: ${error.message}`);return}}localStorage.setItem('hadir-settings',JSON.stringify(values));showToast(supabaseClient?'Pengaturan tersimpan di Supabase':'Pengaturan absensi berhasil disimpan di perangkat ini')})}
  const startQr=document.getElementById('startQr');if(startQr)startQr.addEventListener('click',async()=>{try{if(supabaseClient)await toggleSupabaseSession();else{window.hadirQrActive=!window.hadirQrActive;localStorage.setItem('hadir-qr-active',String(window.hadirQrActive))}renderPage('Absensi QR');showToast(window.hadirQrActive?'Sesi absensi QR dimulai':'Sesi absensi QR diakhiri')}catch(error){showToast(`Sesi QR gagal disimpan: ${error.message}`)}});
  const scanQr=document.getElementById('scanQr');if(scanQr)scanQr.addEventListener('click',startQrCamera);
  const qrManual=document.getElementById('qrManualForm');if(qrManual)qrManual.addEventListener('submit',event=>{event.preventDefault();recordQrAttendance(document.getElementById('qrNis').value)});
  const file=document.getElementById('importFile');if(file)file.addEventListener('change',previewImport);
  const apply=document.getElementById('importApply');if(apply)apply.addEventListener('click',applyImport);
}
function openStudentQrCards(){
  const modal=document.createElement('div');modal.className='module-modal qr-card-modal';
  modal.innerHTML=`<section class="qr-card-sheet"><header class="qr-card-toolbar"><div><h2>Kartu QR Siswa</h2><p>QR berisi NIS siswa dan dapat dipindai pada menu Absensi QR.</p></div><div><button class="module-btn secondary qr-card-close" type="button">Tutup</button><button class="module-btn primary" type="button" id="printQrCards">Cetak Kartu</button></div></header><div class="qr-card-grid">${studentData.map(student=>`<article class="student-qr-card"><div class="student-qr-school">SMA NEGERI 1 HALMAHERA TIMUR</div><div class="student-qr-body"><div class="student-qr-info"><b>${h(student.name)}</b><span>NIS ${h(student.nis)}</span><span>${h(student.class)}</span></div><div class="student-qr-image">${createQrSvg(student.nis)}</div></div><div class="student-qr-foot">KARTU IDENTITAS ABSENSI</div></article>`).join('')}</div></section>`;
  document.body.appendChild(modal);
  modal.querySelector('.qr-card-close').addEventListener('click',()=>modal.remove());
  modal.addEventListener('click',event=>{if(event.target===modal)modal.remove()});
  modal.querySelector('#printQrCards').addEventListener('click',()=>window.print());
}
function openAddForm(kind){
  const specs={
    'add-student':{title:'Tambah Data Siswa',fields:[['NIS','NIS'],['NISN','NISN'],['Nama Lengkap','Nama'],['Kelas','Kelas'],['Jenis Kelamin','Jenis Kelamin'],['Tanggal Lahir (YYYY-MM-DD)','Tanggal Lahir'],['Nama Orang Tua / Wali','Nama Wali'],['Nomor HP Wali','No. HP Wali'],['Alamat','Alamat']]},
    'add-class':{title:'Tambah Data Kelas',fields:[['Nama Kelas','Nama Kelas'],['Tingkat (X / XI / XII)','Tingkat'],['Jurusan','Jurusan'],['Wali Kelas','Wali Kelas'],['Ruang Belajar','Ruang'],['Jumlah Siswa','Jumlah Siswa'],['Kapasitas Kelas','Kapasitas'],['Tahun Ajaran','Tahun Ajaran']]},
    'add-piket':{title:'Tambah Jadwal Piket',fields:[['Hari','Hari'],['Nama Guru','Guru'],['Lokasi Tugas','Lokasi'],['Jam Piket','Jam']]},
    'add-account':{title:'Tambah Pengguna',fields:[['Nama Pengguna','Nama'],['Username','Username'],['Password','Password'],['Email','Email'],['Peran (Administrator / Guru Piket)','Peran']]}
  };const spec=specs[kind];if(!spec)return;
  const modal=document.createElement('div');modal.className='module-modal';modal.innerHTML=`<form class="module-modal-card"><button type="button" class="modal-close" aria-label="Tutup">×</button><h3>${h(spec.title)}</h3><p>Isi informasi berikut untuk menambahkan data.</p>${spec.fields.map(([label,name])=>`<label>${h(label)}<input name="${h(name)}" type="${name==='Password'?'password':'text'}" required></label>`).join('')}<button class="module-btn primary wide">Simpan Data</button></form>`;document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('.modal-close'))modal.remove()});modal.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));if(supabaseClient){let error=null;
    if(kind==='add-student'){const classRow=classData.find(item=>item.name===d.Kelas);const result=await supabaseClient.from('students').insert({nis:d.NIS,nisn:d.NISN||null,full_name:d.Nama,class_id:classRow?.id||null,gender:d['Jenis Kelamin']==='Laki-laki'?'laki_laki':d['Jenis Kelamin']==='Perempuan'?'perempuan':null,date_of_birth:d['Tanggal Lahir']||null,guardian_name:d['Nama Wali']||null,guardian_phone:d['No. HP Wali']||null,address:d.Alamat||null}).select('id').single();error=result.error}
    if(kind==='add-class'){const teacher=teachersData.find(item=>item.full_name===d['Wali Kelas']);const result=await supabaseClient.from('classes').insert({class_name:d['Nama Kelas'],grade_level:d.Tingkat,major:d.Jurusan,homeroom_teacher_id:teacher?.id||null,room_name:d.Ruang||null,capacity:Number(d.Kapasitas)||36,academic_year:d['Tahun Ajaran']||'2026/2027',is_active:true}).select('id').single();error=result.error}
    if(kind==='add-piket'){let teacher=teachersData.find(item=>item.full_name===d.Guru);if(!teacher){const found=await supabaseClient.from('teachers').select('id,full_name').ilike('full_name',d.Guru).maybeSingle();teacher=found.data;error=found.error}if(!error&&!teacher)error={message:'Nama guru tidak ditemukan di data guru Supabase.'};if(!error){const times=d.Jam.match(/(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})/);if(!times)error={message:'Format jam piket harus HH:MM-HH:MM.'};else{const result=await supabaseClient.from('piket_schedules').insert({teacher_id:teacher.id,day_of_week:d.Hari,duty_area:d.Lokasi,start_time:times[1],end_time:times[2],is_active:true});error=result.error}}}
    if(kind==='add-account'){showToast('Buat akun di Supabase Authentication dahulu, lalu tambahkan user_profiles memakai UUID akun tersebut.');return}
    if(error){showToast(`Gagal menyimpan ke Supabase: ${error.message}`);return}await loadSupabaseData();modal.remove();const active=document.querySelector('.nav-item.active')?.dataset.page;renderPage(active);showToast('Data berhasil disimpan ke Supabase');return}
    if(kind==='add-student'){studentData.unshift({nis:d.NIS,nisn:d.NISN,name:d.Nama,class:d.Kelas,gender:d['Jenis Kelamin'],birth:d['Tanggal Lahir'],guardian:d['Nama Wali'],phone:d['No. HP Wali'],address:d.Alamat,status:'Belum Absen'});localStorage.setItem('hadir-students',JSON.stringify(studentData))}if(kind==='add-class'){classData.unshift({name:d['Nama Kelas'],level:d.Tingkat,major:d.Jurusan,teacher:d['Wali Kelas'],room:d.Ruang,count:Number(d['Jumlah Siswa']),capacity:Number(d.Kapasitas),year:d['Tahun Ajaran'],status:'Aktif'});localStorage.setItem('hadir-classes',JSON.stringify(classData))}if(kind==='add-piket')piketData.unshift({day:d.Hari,teacher:d.Guru,area:d.Lokasi,time:d.Jam});if(kind==='add-account'){if(accountData.some(user=>user.username.toLowerCase()===d.Username.toLowerCase())){showToast('Username sudah digunakan');return}accountData.unshift({name:d.Nama,username:d.Username,password:d.Password,email:d.Email,role:d.Peran,state:'Aktif'});localStorage.setItem('hadir-accounts',JSON.stringify(accountData))}modal.remove();const active=document.querySelector('.nav-item.active')?.dataset.page;renderPage(active);showToast('Data berhasil ditambahkan')});
}
let importRows=[];
function previewImport(event){const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{const lines=String(reader.result).split(/\r?\n/).filter(Boolean);importRows=lines.slice(1).map(line=>line.split(',').map(x=>x.trim().replace(/^"|"$/g,''))).filter(row=>row.length>=3);document.getElementById('importPreview').textContent=`${file.name} — ${importRows.length} baris siap diimpor`;document.getElementById('importApply').disabled=!importRows.length};reader.readAsText(file)}
async function applyImport(){
  if(supabaseClient){const fileName=document.getElementById('importFile')?.files?.[0]?.name||'impor.csv';const valid=[],errors=[];for(const[rowIndex,row]of importRows.entries()){const cl=classData.find(item=>item.name.toLowerCase()===String(row[2]||'').trim().toLowerCase());if(!row[0]||!row[1]){errors.push({row:rowIndex+2,error:'NIS dan nama wajib diisi'});continue}valid.push({nis:String(row[0]).trim(),full_name:String(row[1]).trim(),class_id:cl?.id||null,gender:/^l/i.test(row[3]||'')?'laki_laki':/^p/i.test(row[3]||'')?'perempuan':null})}
    let imported=0;if(valid.length){const result=await supabaseClient.from('students').insert(valid).select('id');if(result.error){showToast(`Impor gagal: ${result.error.message}`);return}imported=result.data?.length||valid.length}await supabaseClient.from('data_imports').insert({entity_type:'siswa',file_name:fileName,imported_rows:imported,rejected_rows:errors.length,error_details:errors,imported_by:currentUser?.id||null});importRows=[];await loadSupabaseData();renderPage('Impor Data');showToast(`${imported} siswa diimpor ke Supabase${errors.length?`; ${errors.length} baris ditolak`:''}`);return}
  importRows.forEach(row=>studentData.push({nis:row[0],name:row[1],class:row[2],gender:row[3]||'—',status:'Belum Absen'}));importRows=[];renderPage('Impor Data');showToast('Data siswa berhasil ditambahkan')}
document.querySelectorAll('[data-page]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();const page=link.dataset.page;document.querySelectorAll('.nav-item').forEach(item=>item.classList.remove('active'));link.classList.add('active');
  document.getElementById('sidebar').classList.remove('open');
  if(page==='Dashboard'){showDashboard()}else renderPage(page);
}));
document.getElementById('mobileMenu').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
function applyAttendanceFilters(){const query=document.getElementById('tableSearch').value.trim().toLowerCase(),status=document.getElementById('attendanceStatusFilter')?.value||'',className=document.getElementById('attendanceClassFilter')?.value||'';let shown=0;document.querySelectorAll('#attendanceRows tr').forEach(row=>{const matchesText=row.textContent.toLowerCase().includes(query),matchesStatus=!status||row.cells[4].textContent.trim()===status,matchesClass=!className||row.cells[2].textContent.trim()===className;row.hidden=!(matchesText&&matchesStatus&&matchesClass);if(!row.hidden)shown++});document.getElementById('emptyState').hidden=shown!==0;const footer=document.querySelector('.table-footer>span');if(footer)footer.innerHTML=`Menampilkan <b>${shown}</b> dari <b>1.248</b> siswa`}
document.getElementById('tableSearch').addEventListener('input',applyAttendanceFilters);
document.getElementById('globalSearch').addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.value.trim()){document.getElementById('tableSearch').value=event.target.value;document.getElementById('tableSearch').dispatchEvent(new Event('input'));showToast('Pencarian diterapkan pada aktivitas kehadiran')}});
document.getElementById('globalSearch').addEventListener('input',event=>{if(event.target.value.trim().length>1){document.getElementById('tableSearch').value=event.target.value;document.getElementById('tableSearch').dispatchEvent(new Event('input'))}});
document.getElementById('qrBtn').addEventListener('click',()=>{document.querySelector('[data-page="Absensi QR"]').click()});
document.getElementById('downloadBtn').addEventListener('click',()=>{
  const rows=[['Nama Siswa','NIS','Kelas','Jam Absen','Status'],...Array.from(document.querySelectorAll('#attendanceRows tr')).filter(r=>!r.hidden).map(r=>Array.from(r.querySelectorAll('td')).slice(0,5).map((td,i)=>i===0?td.querySelector('.student b').textContent:td.innerText.trim()))];
  const csv=rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');const link=document.createElement('a');link.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));link.download='laporan-absensi-20-oktober-2026.csv';link.click();URL.revokeObjectURL(link.href);showToast('Laporan absensi berhasil diunduh');
});
document.getElementById('periodSelect').addEventListener('change',event=>showToast(`Periode grafik: ${event.target.value}`));
document.getElementById('filterBtn').addEventListener('click',()=>{let panel=document.getElementById('attendanceFilterPanel');if(panel){panel.remove();document.getElementById('filterBtn').setAttribute('aria-expanded','false');return}const classes=[...new Set(Array.from(document.querySelectorAll('#attendanceRows tr')).map(row=>row.cells[2].textContent.trim()))];panel=document.createElement('div');panel.className='attendance-filter-panel';panel.id='attendanceFilterPanel';panel.innerHTML=`<b>Filter kehadiran</b><label>Status<select id="attendanceStatusFilter"><option value="">Semua status</option><option>Hadir</option><option>Terlambat</option><option>Izin</option><option>Sakit</option><option>Alpa</option></select></label><label>Kelas<select id="attendanceClassFilter"><option value="">Semua kelas</option>${classes.map(name=>`<option>${h(name)}</option>`).join('')}</select></label><div class="attendance-filter-actions"><button type="button" class="module-btn secondary" id="resetAttendanceFilter">Reset</button><button type="button" class="module-btn primary" id="applyAttendanceFilter">Terapkan</button></div>`;document.querySelector('.activity-actions').appendChild(panel);document.getElementById('filterBtn').setAttribute('aria-expanded','true');panel.querySelector('#applyAttendanceFilter').addEventListener('click',()=>{applyAttendanceFilters();panel.remove();document.getElementById('filterBtn').setAttribute('aria-expanded','false')});panel.querySelector('#resetAttendanceFilter').addEventListener('click',()=>{document.getElementById('tableSearch').value='';applyAttendanceFilters();panel.remove();document.getElementById('filterBtn').setAttribute('aria-expanded','false')})});
document.getElementById('helpBtn').addEventListener('click',()=>showToast('Data dashboard diperbarui'));
document.getElementById('footerHelp').addEventListener('click',event=>{event.preventDefault();showToast('Tim bantuan: support@hadir.sch.id')});
document.getElementById('profileBtn').addEventListener('click',()=>showToast('Anda masuk sebagai Administrator'));
document.getElementById('logoutBtn').type='button';
document.getElementById('logoutBtn').addEventListener('click',event=>{event.preventDefault();event.stopPropagation();void logoutApplication()});
document.querySelector('.notification').addEventListener('click',()=>showToast('Tidak ada notifikasi baru'));
document.querySelectorAll('.pagination button:not(:disabled)').forEach(button=>button.addEventListener('click',()=>showToast('Halaman data absensi')));
